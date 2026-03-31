// src/types/connectorText.ts
// Type definitions for Anthropic connector_text content blocks.
// These are returned by the API when CONNECTOR_TEXT feature is enabled.

export type ConnectorTextBlock = {
  type: 'connector_text'
  connector_text: string
}

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  connector_text: string
}

export function isConnectorTextBlock(
  block: unknown,
): block is ConnectorTextBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as ConnectorTextBlock).type === 'connector_text'
  )
}
