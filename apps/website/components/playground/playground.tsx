"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isErr, isOk, type QueryError, type QueryResult, type QuerySpec } from "querypipe";
import { runDevAssertions } from "@/lib/dev-assert";
import { useDebounced } from "@/lib/use-debounced";
import { DemoTable } from "@/components/demo-table";
import { ErrorList } from "@/components/error-list";
import { SpecJson } from "@/components/spec-json";
import { TokenizedInput } from "@/components/tokenized-input";
import { FilterEditor } from "./filter-editor";
import { PRESETS, type PresetId } from "./preset-config";
import { SortEditor } from "./sort-editor";

/**
 * Structural view of the immutable builder, so one component can drive both
 * preset schemas. Field names are validated by the library at runtime; the
 * editors only ever offer fields the schema declares.
 */
interface AnyBuilder {
  stringify(): string;
  toSpec(): QuerySpec;
  parse(input: string): QueryResult<QuerySpec>;
  apply<Row extends object>(rows: readonly Row[]): Row[];
  withSpec(spec: QuerySpec): QueryResult<AnyBuilder>;
  sort(field: never, direction?: "asc" | "desc"): AnyBuilder;
  thenSort(field: never, direction?: "asc" | "desc"): AnyBuilder;
  insertSortAfter(after: never, field: never, direction?: "asc" | "desc"): AnyBuilder;
  removeSort(field: never): AnyBuilder;
  toggleSortDirection(field: never): AnyBuilder;
}

function builderFor(preset: PresetId): AnyBuilder {
  return PRESETS[preset].query as unknown as AnyBuilder;
}

function parseInitial(preset: PresetId, rawQ: string | null): { input: string; spec: QuerySpec } {
  const base = builderFor(preset);
  // `useSearchParams().get` already URL-decodes the param value, so `rawQ`
  // IS the canonical string (which was stored with encodeURIComponent).
  const input = rawQ !== null && rawQ !== "" ? rawQ : PRESETS[preset].defaultInput;
  const parsed = base.parse(input);
  return { input, spec: isOk(parsed) ? parsed.value : base.toSpec() };
}

export function Playground() {
  const searchParams = useSearchParams();
  const initialPreset: PresetId = searchParams.get("schema") === "tasks" ? "tasks" : "products";
  const [presetId, setPresetId] = useState<PresetId>(initialPreset);
  const [{ input, spec }, setState] = useState(() =>
    parseInitial(initialPreset, searchParams.get("q")),
  );
  const [specErrors, setSpecErrors] = useState<readonly QueryError[] | null>(null);
  const [shared, setShared] = useState(false);
  const lastCanonical = useRef<string | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(runDevAssertions, []);
  useEffect(() => () => clearTimeout(shareTimer.current), []);

  const preset = PRESETS[presetId];
  const base = builderFor(presetId);

  const builder = useMemo(() => {
    const result = base.withSpec(spec);
    return isOk(result) ? result.value : base;
  }, [base, spec]);

  const canonical = useMemo(() => builder.stringify(), [builder]);

  /* -- dogfooding: this page's own URL is a querypipe canonical string ---- */
  useEffect(() => {
    const params = new URLSearchParams();
    if (presetId !== "products") params.set("schema", presetId);
    if (canonical !== "") params.set("q", canonical); // URLSearchParams percent-encodes = & : ; ,
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [canonical, presetId]);

  /* -- live parse of the editable canonical string ------------------------ */
  const debouncedInput = useDebounced(input, 150);
  const parsed = useMemo(() => base.parse(debouncedInput), [base, debouncedInput]);

  useEffect(() => {
    if (!isOk(parsed)) return;
    const next = base.withSpec(parsed.value);
    if (!isOk(next)) return;
    const nextCanonical = next.value.stringify();
    if (nextCanonical === lastCanonical.current) return;
    lastCanonical.current = nextCanonical;
    setSpecErrors(null);
    setState((prev) => ({ ...prev, spec: parsed.value }));
  }, [parsed, base]);

  const parseErrors = isErr(parsed) ? parsed.errors : undefined;
  const underlineErrors = debouncedInput === input ? parseErrors : undefined;

  const commit = (next: AnyBuilder) => {
    const nextCanonical = next.stringify();
    lastCanonical.current = nextCanonical;
    setSpecErrors(null);
    setState({ input: nextCanonical, spec: next.toSpec() });
  };

  /** Validation boundary for editor-built specs: withSpec, never hand-rolled checks. */
  const commitCandidate = (candidate: QuerySpec) => {
    const result = base.withSpec(candidate);
    if (isOk(result)) commit(result.value);
    else setSpecErrors(result.errors);
  };

  const switchPreset = (next: PresetId) => {
    if (next === presetId) return;
    setPresetId(next);
    setSpecErrors(null);
    const initial = parseInitial(next, null);
    lastCanonical.current = null;
    setState(initial);
  };

  const onSort = (field: string, additive: boolean) => {
    const f = field as never;
    const existing = spec.sorts.some((s) => s.field === field);
    commit(
      existing ? builder.toggleSortDirection(f) : additive ? builder.thenSort(f) : builder.sort(f),
    );
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      clearTimeout(shareTimer.current);
      shareTimer.current = setTimeout(() => setShared(false), 1600);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  const rows = useMemo(
    () => (spec.cursor === undefined ? builder.apply(preset.rows) : null),
    [builder, spec.cursor, preset.rows],
  );

  const errors = parseErrors ?? specErrors ?? undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Schema preset" className="flex gap-1 rounded-lg border border-line p-0.5">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={presetId === id}
              onClick={() => switchPreset(id)}
              className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                presetId === id ? "bg-tok-key/15 text-tok-key" : "text-ink-muted hover:text-ink"
              }`}
            >
              {PRESETS[id].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={share}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-tok-key/50 bg-tok-key/10 px-3 py-1.5 text-sm font-medium text-tok-key transition-colors hover:bg-tok-key/20"
        >
          {shared ? "Link copied" : "Share this query"}
        </button>
      </div>

      <TokenizedInput
        value={input}
        onChange={(next) => setState((prev) => ({ ...prev, input: next }))}
        errors={underlineErrors}
        ariaLabel="Canonical query string"
        placeholder={preset.defaultInput}
      />
      <p className="text-xs text-ink-muted">
        This page&rsquo;s URL is managed by querypipe itself — the string above is stored in{" "}
        <code className="font-mono">?q=</code> via{" "}
        <code className="font-mono">encodeURIComponent(q.stringify())</code> and restored with{" "}
        <code className="font-mono">parse</code> on load.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <section className="panel p-3" aria-label="Sort chain editor">
            <p className="eyebrow mb-2">sort · thenSort · insertSortAfter</p>
            <SortEditor
              sorts={spec.sorts}
              fields={preset.fields}
              onToggle={(field) => commit(builder.toggleSortDirection(field as never))}
              onRemove={(field) => commit(builder.removeSort(field as never))}
              onAdd={(field, direction, after) =>
                commit(
                  after === null
                    ? builder.thenSort(field as never, direction)
                    : builder.insertSortAfter(after as never, field as never, direction),
                )
              }
            />
          </section>

          <section className="panel p-3" aria-label="Filter editor">
            <p className="eyebrow mb-2">filter (root AND)</p>
            <FilterEditor spec={spec} fields={preset.fields} onSpecCandidate={commitCandidate} />
          </section>

          <section className="panel p-3" aria-label="Pagination">
            <p className="eyebrow mb-2">limit · offset</p>
            <PaginationEditor spec={spec} onSpecCandidate={commitCandidate} />
          </section>

          <section className="panel" aria-label="Parsed QuerySpec">
            <header className="flex items-center justify-between border-b border-line px-3 py-1.5">
              <span className="eyebrow">{errors ? "Result (errors)" : "QuerySpec"}</span>
              <span className={`font-mono text-[11px] ${errors ? "text-tok-err" : "text-tok-value"}`}>
                {errors ? `${errors.length} error${errors.length === 1 ? "" : "s"}` : "ok"}
              </span>
            </header>
            <div className="max-h-72 overflow-auto p-3">
              {errors ? <ErrorList errors={errors} /> : <SpecJson value={spec} />}
            </div>
          </section>
        </div>

        <section className="panel self-start" aria-label="Result rows">
          <header className="border-b border-line px-3 py-1.5">
            <span className="eyebrow">
              apply(rows) — {rows === null ? "—" : rows.length} of {preset.rows.length}
            </span>
          </header>
          <div className="max-h-[560px] overflow-auto">
            {rows === null ? (
              <p className="px-3 py-6 text-xs text-ink-muted">
                Specs carrying <code className="font-mono">cursor</code> are not executable
                client-side in v0.1 — keyset execution ships with the v0.2 adapters. The spec and
                canonical string above remain fully valid.
              </p>
            ) : (
              <DemoTable
                rows={rows as Array<{ id: number }>}
                columns={preset.columns}
                sorts={spec.sorts}
                onSort={onSort}
                dimmed={parseErrors !== undefined}
              />
            )}
          </div>
          <p className="border-t border-line px-3 py-1.5 text-[11px] text-ink-muted">
            Click a header to <code className="font-mono">sort</code> · shift+click to{" "}
            <code className="font-mono">thenSort</code> · click a sorted header to toggle
            direction.
          </p>
        </section>
      </div>
    </div>
  );
}

function PaginationEditor({
  spec,
  onSpecCandidate,
}: {
  spec: QuerySpec;
  onSpecCandidate: (candidate: QuerySpec) => void;
}) {
  const [limit, setLimit] = useState(spec.limit?.toString() ?? "");
  const [offset, setOffset] = useState(spec.offset?.toString() ?? "");

  // Keep local fields in sync when the spec changes from the string/URL side.
  useEffect(() => {
    setLimit(spec.limit?.toString() ?? "");
    setOffset(spec.offset?.toString() ?? "");
  }, [spec.limit, spec.offset]);

  const apply = () => {
    const candidate: QuerySpec = {
      ...spec,
      limit: limit === "" ? undefined : Number(limit),
      offset: offset === "" ? undefined : Number(offset),
    };
    onSpecCandidate(candidate);
  };

  return (
    <div className="flex flex-wrap items-end gap-2 font-mono text-xs">
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">limit</span>
        <input
          inputMode="numeric"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="—"
          className="w-20 rounded border border-line bg-panel px-1.5 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">offset</span>
        <input
          inputMode="numeric"
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          placeholder="—"
          className="w-20 rounded border border-line bg-panel px-1.5 py-1"
        />
      </label>
      <button
        type="button"
        onClick={apply}
        className="rounded border border-tok-key/50 bg-tok-key/10 px-2 py-1 text-tok-key transition-colors hover:bg-tok-key/20"
      >
        Apply
      </button>
      {spec.cursor !== undefined ? (
        <span className="text-ink-muted">
          cursor=<span className="tok-value">{spec.cursor}</span> (mutually exclusive with offset)
        </span>
      ) : null}
    </div>
  );
}
