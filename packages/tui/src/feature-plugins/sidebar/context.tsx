import { Plugin } from "@opencode-ai/plugin/tui"
import { createMemo, Show } from "solid-js"
import { contextUsage } from "../../util/session"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K"
  return n.toString()
}

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const msg = createMemo(() => props.context.data.session.message.list(props.sessionID))
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const cost = createMemo(() => props.context.data.session.cost(props.sessionID))

  const state = createMemo(() =>
    contextUsage(msg(), props.context.data.location.model.list(session()?.location), session()?.revert?.messageID),
  )

  return (
    <Show when={state() || cost() > 0}>
      <box>
        <text fg={theme.text.default}>
          <b>Context</b>
        </text>
        <Show when={state()}>
          {(value) => {
            const usage = value()
            return (
              <>
                <text fg={theme.text.subdued}>
                  {formatTokens(usage.tokens)}
                  {usage.limit !== undefined ? ` / ${formatTokens(usage.limit)} tokens` : " tokens"}
                </text>
                <Show when={usage.percent !== undefined}>
                  <text fg={theme.text.subdued}>{usage.percent}% used</text>
                </Show>
              </>
            )
          }}
        </Show>
        <Show when={cost() > 0}>
          <text fg={theme.text.subdued}>{money.format(cost())} spent</text>
        </Show>
        <Show when={state()?.cost}>
          {(value) => (
            <text fg={theme.text.subdued}>
              {money.format(value().input)}/in, {money.format(value().output)}/out per 1M
            </text>
          )}
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "opencode.sidebar.context",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarContext context={context} sessionID={props.sessionID} />,
    })
  },
})
