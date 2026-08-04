function tradeDateOf(event) {
  return event?.cffexPositionAnalysis?.tradeDate || '';
}

export function mergeCffexPositionEvents(existingEvents, incomingEvent) {
  const incomingDate = tradeDateOf(incomingEvent);
  if (!incomingDate) throw new Error('CFFEX position event is missing tradeDate');

  const byTradeDate = new Map();
  for (const event of Array.isArray(existingEvents) ? existingEvents : []) {
    const tradeDate = tradeDateOf(event);
    if (tradeDate) byTradeDate.set(tradeDate, event);
  }
  byTradeDate.set(incomingDate, incomingEvent);

  return [...byTradeDate.values()].sort((left, right) => tradeDateOf(left).localeCompare(tradeDateOf(right)));
}
