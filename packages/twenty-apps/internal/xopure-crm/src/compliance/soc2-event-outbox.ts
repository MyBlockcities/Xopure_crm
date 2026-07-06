// ---------------------------------------------------------------------------
// SOC2 in-memory event outbox — ordered FIFO with previous_hash chaining
// ---------------------------------------------------------------------------

/** A fully-populated SOC2 event record after emission. */
export interface Soc2EmittedRecord {
  [field: string]: unknown;
  event_hash: string;
  previous_event_hash: string;
}

/**
 * In-memory outbox that stores emitted SOC2 records in insertion order.
 *
 * Exposes enqueue / list / clear / lastHash operations for testing and
 * chain-validation.
 */
export class Soc2EventOutbox {
  private records: Soc2EmittedRecord[] = [];

  /** Append an emitted record and return it. */
  enqueue(record: Soc2EmittedRecord): Soc2EmittedRecord {
    this.records.push(record);
    return record;
  }

  /** Return a copy of all enqueued records. */
  list(): readonly Soc2EmittedRecord[] {
    return [...this.records];
  }

  /** Remove all records. */
  clear(): void {
    this.records = [];
  }

  /**
   * The event_hash of the most recently enqueued record.
   * Returns `undefined` when the outbox is empty.
   */
  lastHash(): string | undefined {
    const last = this.records[this.records.length - 1];
    return last?.event_hash;
  }
}

const DEFAULT_OUTBOX = new Soc2EventOutbox();

/** Return the module-level SOC2 event outbox shared by runtime producers. */
export function getDefaultOutbox(): Soc2EventOutbox {
  return DEFAULT_OUTBOX;
}
