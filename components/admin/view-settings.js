"use client";

import {
  OPERATOR_LABELS,
  OPERATORS_BY_TYPE,
  operatorUsesDateInput,
  propertyValueOptions,
  getViewProperty,
  VALUELESS_OPERATORS,
  VIEW_PROPERTIES
} from "@/lib/admin-properties";

const SCALES = ["day", "week", "month", "quarter", "year"];
const CHART_TYPES = ["bar", "line", "pie"];
const AGGREGATIONS = ["count", "sum", "avg", "min", "max"];
const DATE_PROPERTIES = VIEW_PROPERTIES.filter((property) =>
  ["date", "formula-date"].includes(property.type)
);
const GROUPABLE_PROPERTIES = VIEW_PROPERTIES.filter((property) =>
  ["select", "multiselect", "checkbox", "text"].includes(property.type)
);

function PropertySelect({ value, onChange, properties = VIEW_PROPERTIES, allowNone = false, noneLabel = "—" }) {
  return (
    <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
      {allowNone ? <option value="">{noneLabel}</option> : null}
      {properties.map((property) => (
        <option key={property.key} value={property.key}>
          {property.label}
        </option>
      ))}
    </select>
  );
}

export default function ViewSettings({ layout, config, updateConfig }) {
  const visible = Array.isArray(config.visibleProperties) ? config.visibleProperties : [];
  const filters = config.filters || { combinator: "and", rules: [] };
  const sorts = Array.isArray(config.sorts) ? config.sorts : [];

  function toggleProperty(key) {
    updateConfig({
      visibleProperties: visible.includes(key)
        ? visible.filter((candidate) => candidate !== key)
        : [...visible, key]
    });
  }

  function moveProperty(key, direction) {
    const index = visible.indexOf(key);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= visible.length) {
      return;
    }

    const next = [...visible];

    [next[index], next[target]] = [next[target], next[index]];
    updateConfig({ visibleProperties: next });
  }

  function updateRule(index, patch) {
    const rules = filters.rules.map((rule, candidate) =>
      candidate === index ? { ...rule, ...patch } : rule
    );

    updateConfig({ filters: { ...filters, rules } });
  }

  function updateSort(index, patch) {
    updateConfig({
      sorts: sorts.map((sort, candidate) => (candidate === index ? { ...sort, ...patch } : sort))
    });
  }

  return (
    <div className="admin-view-settings">
      {["timeline", "calendar"].includes(layout) ? (
        <section className="admin-view-settings__section">
          <div className="admin-detail__section-title">
            {layout === "timeline" ? "Timeline" : "Calendar"} settings
          </div>
          <div className="admin-view-settings__row">
            <label>Date property</label>
            <PropertySelect
              value={config.dateProperty}
              onChange={(value) => updateConfig({ dateProperty: value })}
              properties={DATE_PROPERTIES}
            />
            {layout === "timeline" ? (
              <>
                <label>Scale</label>
                <select
                  value={config.scale || "month"}
                  onChange={(event) => updateConfig({ scale: event.target.value })}
                >
                  {SCALES.map((scale) => (
                    <option key={scale} value={scale}>
                      {scale}
                    </option>
                  ))}
                </select>
                <label>Property table</label>
                <select
                  value={config.showTable === false ? "hide" : "show"}
                  onChange={(event) => updateConfig({ showTable: event.target.value === "show" })}
                >
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                </select>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {layout === "chart" ? (
        <section className="admin-view-settings__section">
          <div className="admin-detail__section-title">Chart settings</div>
          <div className="admin-view-settings__row">
            <label>Type</label>
            <select
              value={config.chartType || "bar"}
              onChange={(event) => updateConfig({ chartType: event.target.value })}
            >
              {CHART_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <label>X axis</label>
            <PropertySelect
              value={config.xProperty}
              onChange={(value) => updateConfig({ xProperty: value })}
            />
            <label>Aggregation</label>
            <select
              value={config.aggregation || "count"}
              onChange={(event) => updateConfig({ aggregation: event.target.value })}
            >
              {AGGREGATIONS.map((aggregation) => (
                <option key={aggregation} value={aggregation}>
                  {aggregation}
                </option>
              ))}
            </select>
            {config.aggregation && config.aggregation !== "count" ? (
              <>
                <label>Y axis</label>
                <PropertySelect
                  value={config.yProperty}
                  onChange={(value) => updateConfig({ yProperty: value })}
                  allowNone
                />
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {layout === "calendar" ? (
        <section className="admin-view-settings__section">
          <div className="admin-detail__section-title">Card properties</div>
          <div className="admin-view-settings__properties">
            {VIEW_PROPERTIES.map((property) => {
              const cardProperties = Array.isArray(config.cardProperties)
                ? config.cardProperties
                : [];
              const checked = cardProperties.includes(property.key);

              return (
                <label key={property.key} className="admin-view-settings__property">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      updateConfig({
                        cardProperties: checked
                          ? cardProperties.filter((candidate) => candidate !== property.key)
                          : [...cardProperties, property.key]
                      })
                    }
                  />
                  {property.label}
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {layout !== "calendar" && layout !== "chart" ? (
        <section className="admin-view-settings__section">
          <div className="admin-detail__section-title">Visible properties</div>
          <div className="admin-view-settings__visible">
            {visible.map((key) => {
              const property = getViewProperty(key);

              if (!property) {
                return null;
              }

              return (
                <div key={key} className="admin-view-settings__visible-item">
                  <span>{property.label}</span>
                  <span>
                    <button type="button" onClick={() => moveProperty(key, -1)}>
                      ↑
                    </button>
                    <button type="button" onClick={() => moveProperty(key, 1)}>
                      ↓
                    </button>
                    <button type="button" onClick={() => toggleProperty(key)}>
                      Hide
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <details className="admin-view-settings__all">
            <summary>Show / hide properties</summary>
            <div className="admin-view-settings__properties">
              {VIEW_PROPERTIES.map((property) => (
                <label key={property.key} className="admin-view-settings__property">
                  <input
                    type="checkbox"
                    checked={visible.includes(property.key)}
                    onChange={() => toggleProperty(property.key)}
                  />
                  {property.label}
                </label>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      <section className="admin-view-settings__section">
        <div className="admin-detail__section-title">Filters</div>
        {filters.rules.length > 1 ? (
          <div className="admin-view-settings__row">
            <label>Match</label>
            <select
              value={filters.combinator || "and"}
              onChange={(event) =>
                updateConfig({ filters: { ...filters, combinator: event.target.value } })
              }
            >
              <option value="and">All filters (AND)</option>
              <option value="or">Any filter (OR)</option>
            </select>
          </div>
        ) : null}
        {filters.rules.map((rule, index) => {
          const property = getViewProperty(rule.property) || VIEW_PROPERTIES[0];
          const operators = OPERATORS_BY_TYPE[property.type] || OPERATORS_BY_TYPE.text;
          const options = propertyValueOptions(property);

          return (
            <div key={index} className="admin-view-settings__rule">
              <PropertySelect
                value={rule.property}
                onChange={(value) => {
                  const nextProperty = getViewProperty(value);
                  const nextOperators = OPERATORS_BY_TYPE[nextProperty.type] || [];

                  updateRule(index, {
                    property: value,
                    op: nextOperators.includes(rule.op) ? rule.op : nextOperators[0],
                    value: ""
                  });
                }}
              />
              <select
                value={rule.op}
                onChange={(event) => updateRule(index, { op: event.target.value })}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op] || op}
                  </option>
                ))}
              </select>
              {!VALUELESS_OPERATORS.has(rule.op) ? (
                options ? (
                  <select
                    value={rule.value || ""}
                    onChange={(event) => updateRule(index, { value: event.target.value })}
                  >
                    <option value="">—</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={operatorUsesDateInput(property, rule.op) ? "date" : "text"}
                    value={rule.value || ""}
                    onChange={(event) => updateRule(index, { value: event.target.value })}
                  />
                )
              ) : null}
              <button
                type="button"
                className="admin-ghost-button"
                onClick={() =>
                  updateConfig({
                    filters: {
                      ...filters,
                      rules: filters.rules.filter((candidate, candidateIndex) => candidateIndex !== index)
                    }
                  })
                }
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="admin-ghost-button"
          onClick={() =>
            updateConfig({
              filters: {
                ...filters,
                rules: [...filters.rules, { property: "status", op: "is", value: "" }]
              }
            })
          }
        >
          + Add filter
        </button>
      </section>

      <section className="admin-view-settings__section">
        <div className="admin-detail__section-title">Sorts</div>
        {sorts.map((sort, index) => (
          <div key={index} className="admin-view-settings__rule">
            <PropertySelect
              value={sort.property}
              onChange={(value) => updateSort(index, { property: value })}
            />
            <select
              value={sort.dir || "asc"}
              onChange={(event) => updateSort(index, { dir: event.target.value })}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <button
              type="button"
              className="admin-ghost-button"
              onClick={() =>
                updateConfig({ sorts: sorts.filter((candidate, candidateIndex) => candidateIndex !== index) })
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="admin-ghost-button"
          onClick={() =>
            updateConfig({ sorts: [...sorts, { property: "release_date", dir: "desc" }] })
          }
        >
          + Add sort
        </button>
      </section>

      {layout !== "chart" ? (
        <section className="admin-view-settings__section">
          <div className="admin-detail__section-title">Group by</div>
          <div className="admin-view-settings__row">
            <PropertySelect
              value={config.groupBy}
              onChange={(value) => updateConfig({ groupBy: value })}
              properties={GROUPABLE_PROPERTIES}
              allowNone
              noneLabel="No grouping"
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
