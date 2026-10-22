import Anthropic from "@anthropic-ai/sdk";
import { todayISO } from "@/core/lib/date";
import { type RootState, useStore } from "@/core/store";
import {
  buildCloseTaskAction,
  buildFocusGoalAction,
  buildPlanWeekAction,
  formatAddTaskLabel,
} from "./agent-actions";
import { getAgentModel, getAnthropicKey } from "./config";
import type { Agent, AgentAction, AgentResult } from "./types";
import { parseWhen } from "./when";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "add_task",
    description: "Create a new task. Use for 'add/create/remind me to …'. Omit date for backlog.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "ISO yyyy-mm-dd, or omit for backlog" },
        time: { type: "string", description: "HH:mm 24h, optional" },
        valueId: { type: "string", description: "id of a value it serves, optional" },
        goalId: { type: "string", description: "id of a goal it serves, optional" },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description:
      "Mark an existing open task done. taskId must be from the provided open-tasks list.",
    input_schema: {
      type: "object",
      properties: { taskId: { type: "string" } },
      required: ["taskId"],
    },
  },
  {
    name: "skip_task",
    description: "Skip an existing open task. taskId must be from the provided open-tasks list.",
    input_schema: {
      type: "object",
      properties: { taskId: { type: "string" } },
      required: ["taskId"],
    },
  },
  {
    name: "plan_week",
    description: "Fill the upcoming week with scheduled habit blocks.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "focus_goal",
    description: "Set the global focus filter to a goal. goalId from the provided goals list.",
    input_schema: {
      type: "object",
      properties: { goalId: { type: "string" } },
      required: ["goalId"],
    },
  },
  {
    name: "show",
    description:
      "Surface a focused read-only view answering a 'what/show/which' question. Provide taskIds to render a task list, and/or lines for freeform bullet text.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        taskIds: { type: "array", items: { type: "string" } },
        lines: { type: "array", items: { type: "string" } },
      },
      required: ["title"],
    },
  },
];

const SYSTEM = `You are VEGA's command agent. The user types a short request in a command palette.
Use the provided tools to propose concrete actions over their real data. Resolve value/goal
names to the ids given in CONTEXT. For "what / show / which / how am I doing" questions, call
the "show" tool. Prefer a tool call over prose. If you also explain, keep it to one short sentence.
Today is ${"{TODAY}"}.`;

function buildAgentContext(): string {
  const state = useStore.getState();
  const open = state.tasks.filter((t) => t.status !== "done" && t.status !== "skip");
  return JSON.stringify({
    today: todayISO(),
    values: state.values.map((v) => ({ id: v.id, name: v.name })),
    goals: state.goals.map((g) => ({
      id: g.id,
      name: g.name,
      progress: Math.round(g.progress * 100),
    })),
    openTasks: open.slice(0, 60).map((t) => ({ id: t.id, title: t.title, date: t.date })),
  });
}

type ToolInput = Record<string, unknown>;
type ActionBuilder = (state: RootState, input: ToolInput, id: string) => AgentAction | null;

const buildCloseTaskBuilder =
  (status: "done" | "skip"): ActionBuilder =>
  (state, input, id) => {
    const task = state.tasks.find((x) => x.id === input.taskId);
    return task ? buildCloseTaskAction(state, task, status, id) : null;
  };

function buildAddTaskAction(state: RootState, input: ToolInput, id: string): AgentAction | null {
  const title = String(input.title ?? "").trim();
  if (!title) return null;
  const when = parseWhen(title);
  const date = (input.date as string) ?? when.date ?? null;
  const time = (input.time as string) ?? when.time ?? null;
  return {
    id,
    icon: "plus",
    label: formatAddTaskLabel(title, date, time),
    run: () => {
      state.addTask({
        title,
        date,
        time,
        valueId: (input.valueId as string) ?? null,
        goalId: (input.goalId as string) ?? null,
      });
      state.pushToast(`Added "${title}"`);
    },
  };
}

const buildShowAction: ActionBuilder = (state, input, id) => ({
  id,
  icon: "calendar",
  label: `Show: ${String(input.title ?? "view")}`,
  run: () =>
    state.setEphemeral({
      title: String(input.title ?? "View"),
      subtitle: input.subtitle as string | undefined,
      taskIds: (input.taskIds as string[]) ?? undefined,
      lines: (input.lines as string[]) ?? undefined,
      createdAt: Date.now(),
    }),
});

const ACTION_BUILDERS = new Map<string, ActionBuilder>([
  ["add_task", buildAddTaskAction],
  ["complete_task", buildCloseTaskBuilder("done")],
  ["skip_task", buildCloseTaskBuilder("skip")],
  ["plan_week", (state, _input, id) => buildPlanWeekAction(state, id)],
  [
    "focus_goal",
    (state, input, id) => {
      const goal = state.goals.find((x) => x.id === input.goalId);
      return goal ? buildFocusGoalAction(state, goal, id, goal.icon) : null;
    },
  ],
  ["show", buildShowAction],
]);

function toAction(name: string, input: ToolInput, idx: number): AgentAction | null {
  const build = ACTION_BUILDERS.get(name);
  return build ? build(useStore.getState(), input, `ai-${idx}`) : null;
}

export class AnthropicAgent implements Agent {
  id = "anthropic";

  async suggest(query: string): Promise<AgentResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return { actions: [] };
    const apiKey = getAnthropicKey();
    if (!apiKey) return { actions: [] };

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    // `thinking: {type:"adaptive"}` + `output_config: {effort}` are valid on
    // claude-opus-4-8 / claude-haiku-4-5 but not yet in this SDK version's
    // types — cast the params so the runtime payload stays correct.
    const response = await client.messages.create({
      model: getAgentModel(),
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: `${SYSTEM.replace("{TODAY}", todayISO())}\n\nCONTEXT:\n${buildAgentContext()}`,
      tools: TOOLS,
      messages: [{ role: "user", content: trimmedQuery }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    const actions: AgentAction[] = [];
    let message = "";
    response.content.forEach((block, i) => {
      if (block.type === "tool_use") {
        const action = toAction(block.name, block.input as Record<string, unknown>, i);
        if (action) actions.push(action);
      } else if (block.type === "text") {
        message += block.text;
      }
    });
    return { actions, message: message.trim() || undefined };
  }
}
