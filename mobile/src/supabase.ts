export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export type PublicDataError = {
  code?: string;
  message: string;
  status: number;
};

export type PublicDataResult = {
  data: unknown[] | Record<string, unknown> | null;
  error: PublicDataError | null;
  status: number;
};

type Filter = {
  column: string;
  operator: "eq" | "ilike" | "in";
  value: string;
};

const safeIdentifier = (value: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Invalid public data identifier: ${value}`);
  }
  return value;
};

class PublicDataQuery implements PromiseLike<PublicDataResult> {
  private columns = "*";
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | null = null;
  private single = false;

  constructor(private readonly table: string) {}

  select(columns = "*") {
    this.columns = columns;
    return this;
  }

  eq(column: string, value: string | number | boolean) {
    this.filters.push({
      column: safeIdentifier(column),
      operator: "eq",
      value: String(value),
    });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({
      column: safeIdentifier(column),
      operator: "ilike",
      value,
    });
    return this;
  }

  in(column: string, values: string[]) {
    this.filters.push({
      column: safeIdentifier(column),
      operator: "in",
      value: values.join(","),
    });
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.orders.push({
      column: safeIdentifier(column),
      ascending: options.ascending,
    });
    return this;
  }

  limit(value: number) {
    this.rowLimit = Math.max(0, Math.floor(value));
    return this;
  }

  maybeSingle() {
    this.single = true;
    this.rowLimit = 2;
    return this;
  }

  private async execute(): Promise<PublicDataResult> {
    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: {
          message: "Supabase public data endpoint is not configured.",
          status: 0,
        },
        status: 0,
      };
    }

    const url = new URL(
      `/rest/v1/${safeIdentifier(this.table)}`,
      supabaseUrl.endsWith("/") ? supabaseUrl : `${supabaseUrl}/`,
    );
    url.searchParams.set("select", this.columns);

    for (const filter of this.filters) {
      const value =
        filter.operator === "in"
          ? `in.(${filter.value})`
          : `${filter.operator}.${filter.value}`;
      url.searchParams.set(filter.column, value);
    }

    if (this.orders.length > 0) {
      url.searchParams.set(
        "order",
        this.orders
          .map(({ column, ascending }) => `${column}.${ascending ? "asc" : "desc"}`)
          .join(","),
      );
    }

    if (this.rowLimit !== null) {
      url.searchParams.set("limit", String(this.rowLimit));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: supabaseAnonKey,
          "X-Client-Info": "hinduja-antibiotic-guide-public-data",
        },
      });
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Public data request failed.",
          status: 0,
        },
        status: 0,
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | unknown[]
      | Record<string, unknown>
      | null;

    if (!response.ok) {
      const errorPayload =
        payload && !Array.isArray(payload) ? payload : ({} as Record<string, unknown>);
      return {
        data: null,
        error: {
          code:
            typeof errorPayload.code === "string" ? errorPayload.code : undefined,
          message:
            typeof errorPayload.message === "string"
              ? errorPayload.message
              : `Public data request returned HTTP ${response.status}.`,
          status: response.status,
        },
        status: response.status,
      };
    }

    const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
    if (this.single) {
      if (rows.length === 0) {
        return { data: null, error: null, status: response.status };
      }
      if (rows.length > 1) {
        return {
          data: null,
          error: {
            code: "MULTIPLE_ROWS",
            message: "Expected at most one public data row.",
            status: 406,
          },
          status: 406,
        };
      }
      return {
        data: rows[0] as Record<string, unknown>,
        error: null,
        status: response.status,
      };
    }

    return { data: rows, error: null, status: response.status };
  }

  then<TResult1 = PublicDataResult, TResult2 = never>(
    onfulfilled?:
      | ((value: PublicDataResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from(table: string) {
    return new PublicDataQuery(safeIdentifier(table));
  },
};
