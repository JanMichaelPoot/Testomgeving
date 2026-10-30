// A small in-memory stand-in for the Supabase client, for tests of the voucher code. It understands just what that code uses: insert, update, delete and
// select with eq / is / gt / lte / in / like filters, `.select()` after a write, single and maybeSingle, and unique columns (error code 23505).
// Conditional updates behave like the database's: the filters are applied to the rows that exist at that moment, so "update ... where status = 'active'"
// really only matches once.

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null };

export interface FakeOptions {
  /** Columns that must be unique per table; inserting a duplicate fails with code 23505. */
  unique?: Record<string, string[]>;
  /** Called before an insert; return an error to make it fail (e.g. a missing column). */
  beforeInsert?: (table: string, row: Row) => { code?: string; message: string } | null | void;
}

export function fakeSupabase(seed: Record<string, Row[]> = {}, options: FakeOptions = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  let counter = 0;

  class Query implements PromiseLike<Result> {
    private op: "select" | "insert" | "update" | "delete" = "select";
    private payload: Row | Row[] = {};
    private filters: ((row: Row) => boolean)[] = [];
    private wantRows = false;

    constructor(private table: string) {
      tables[table] ??= [];
    }

    select() {
      this.wantRows = true;
      return this;
    }
    insert(payload: Row | Row[]) {
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    update(payload: Row) {
      this.op = "update";
      this.payload = payload;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push((r) => r[column] === value);
      return this;
    }
    neq(column: string, value: unknown) {
      this.filters.push((r) => r[column] !== value);
      return this;
    }
    is(column: string, value: unknown) {
      this.filters.push((r) => (r[column] ?? null) === value);
      return this;
    }
    not(column: string, _operator: string, value: unknown) {
      this.filters.push((r) => (r[column] ?? null) !== value);
      return this;
    }
    gt(column: string, value: unknown) {
      this.filters.push((r) => typeof r[column] === "string" && (r[column] as string) > (value as string));
      return this;
    }
    gte(column: string, value: unknown) {
      this.filters.push((r) => typeof r[column] === "string" && (r[column] as string) >= (value as string));
      return this;
    }
    lte(column: string, value: unknown) {
      this.filters.push((r) => typeof r[column] === "string" && (r[column] as string) <= (value as string));
      return this;
    }
    in(column: string, values: unknown[]) {
      this.filters.push((r) => values.includes(r[column]));
      return this;
    }
    like(column: string, pattern: string) {
      const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`);
      this.filters.push((r) => typeof r[column] === "string" && re.test(r[column] as string));
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    range() {
      return this;
    }

    private run(): Result {
      const rows = tables[this.table];
      if (this.op === "insert") {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted: Row[] = [];
        for (const row of incoming) {
          const failure = options.beforeInsert?.(this.table, row);
          if (failure) return { data: null, error: failure };
          for (const column of options.unique?.[this.table] ?? []) {
            if (row[column] != null && rows.some((r) => r[column] === row[column])) {
              return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "${this.table}_${column}_key"` } };
            }
          }
          const stored: Row = { id: `${this.table}-${++counter}`, ...row };
          rows.push(stored);
          inserted.push({ ...stored });
        }
        return { data: this.wantRows ? inserted : null, error: null };
      }
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") {
        for (const r of matched) Object.assign(r, this.payload);
        return { data: this.wantRows ? matched.map((r) => ({ ...r })) : null, error: null };
      }
      if (this.op === "delete") {
        tables[this.table] = rows.filter((r) => !matched.includes(r));
        return { data: null, error: null };
      }
      return { data: matched.map((r) => ({ ...r })), error: null };
    }

    single(): Promise<Result> {
      const result = this.run();
      if (result.error) return Promise.resolve(result);
      const list = result.data as Row[];
      return Promise.resolve(list.length === 1 ? { data: list[0], error: null } : { data: null, error: { message: `expected one row, got ${list.length}` } });
    }
    maybeSingle(): Promise<Result> {
      const result = this.run();
      if (result.error) return Promise.resolve(result);
      const list = result.data as Row[];
      return Promise.resolve({ data: list[0] ?? null, error: null });
    }
    then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  return {
    from: (table: string) => new Query(table),
    /** The rows of a table right now, for assertions. */
    rows: (table: string) => (tables[table] ?? []).map((r) => ({ ...r })),
  };
}
