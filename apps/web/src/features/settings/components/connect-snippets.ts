export function buildConnectSnippets(
  endpointUrl: string,
  token: string,
): { claudeCode: string; codex: string; json: string } {
  const claudeCode = `claude mcp add --transport http vega ${endpointUrl} --header "Authorization: Bearer ${token}"`;
  const codex = `[mcp_servers.vega]
url = "${endpointUrl}"
http_headers = { Authorization = "Bearer ${token}" }`;
  const json = JSON.stringify(
    {
      mcpServers: {
        vega: {
          type: "http",
          url: endpointUrl,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
  return { claudeCode, codex, json };
}
