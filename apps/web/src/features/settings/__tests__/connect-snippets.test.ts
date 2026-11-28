import { describe, expect, it } from "vitest";
import { buildConnectSnippets } from "../components/connect-snippets";

const url = "https://api.example.com/mcp";
const token = "vega_pat_testtoken";

describe("buildConnectSnippets", () => {
  it("embeds the endpoint and bearer token in every snippet", () => {
    const snippets = buildConnectSnippets(url, token);
    expect(snippets.claudeCode).toContain(url);
    expect(snippets.claudeCode).toContain(`Bearer ${token}`);
    expect(snippets.codex).toContain(url);
    expect(snippets.codex).toContain(`Bearer ${token}`);
    expect(snippets.json).toContain(url);
    expect(snippets.json).toContain(`Bearer ${token}`);
  });

  it("matches the Claude Code command exactly", () => {
    const snippets = buildConnectSnippets(url, token);
    expect(snippets.claudeCode).toBe(
      `claude mcp add --transport http vega ${url} --header "Authorization: Bearer ${token}"`,
    );
  });

  it("matches the Codex TOML exactly", () => {
    const snippets = buildConnectSnippets(url, token);
    expect(snippets.codex).toBe(
      `[mcp_servers.vega]
url = "${url}"
http_headers = { Authorization = "Bearer ${token}" }`,
    );
  });

  it("produces valid JSON", () => {
    const snippets = buildConnectSnippets(url, token);
    expect(() => JSON.parse(snippets.json)).not.toThrow();
    const parsed = JSON.parse(snippets.json) as {
      mcpServers: { vega: { type: string; url: string; headers: { Authorization: string } } };
    };
    expect(parsed.mcpServers.vega.type).toBe("http");
    expect(parsed.mcpServers.vega.url).toBe(url);
    expect(parsed.mcpServers.vega.headers.Authorization).toBe(`Bearer ${token}`);
  });
});
