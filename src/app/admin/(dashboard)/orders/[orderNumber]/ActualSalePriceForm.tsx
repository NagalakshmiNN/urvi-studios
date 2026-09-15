"use client";

// What this order actually sold for. Required, because an order with no
// recorded figure is a hole in the month's takings that nobody notices until
// the numbers are being added up.
//
// The checks below mirror src/lib/sale-price.ts exactly, so the message shown
// while typing is the message the server would give. The server still decides:
// these are here to save a round trip, not to be trusted.

import { useActionState, useState } from "react";
import { setActualSalePriceAction } from "@/app/actions/admin";
import { formatINR } from "@/lib/format";
import { REQUIRED_MESSAGE, parseActualSalePrice, paiseToInput } from "@/lib/sale-price";

export default function ActualSalePriceForm({
  orderId,
  orderTotal,
  currentPaise,
}: {
  orderId: string;
  orderTotal: number;
  currentPaise: number | null;
}) {
  const [state, formAction, pending] = useActionState(setActualSalePriceAction, undefined);
  const [value, setValue] = useState(currentPaise != null ? paiseToInput(currentPaise) : "");
  const [touched, setTouched] = useState(false);
  // Whether the field has been edited since the last submit. Without this, a
  // rejection from the server keeps shouting after the value has been
  // corrected — the message would say "required" next to a perfectly good
  // number, which teaches people to ignore the message.
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false);

  const check = parseActualSalePrice(value, orderTotal);
  // Nothing is said until the field has been used — an untouched form shouting
  // "required" at someone who just opened the page is noise, not help.
  const liveError = touched && !check.ok ? check.error : null;
  const serverError = editedSinceSubmit ? null : state?.error;
  const message = liveError ?? serverError ?? null;

  return (
    <form action={formAction} className="sale-price-form" noValidate>
      <input type="hidden" name="orderId" value={orderId} />

      <div>
        <label htmlFor="actualSalePrice" className="field-label">
          Actual Sale Price <span className="required-mark" aria-hidden="true">*</span>
        </label>
        <div className="sale-price-row">
          <span className="sale-price-prefix" aria-hidden="true">₹</span>
          <input
            id="actualSalePrice"
            name="actualSalePrice"
            className="admin-inline-input"
            // Not type="number": it lets browsers accept "1e5" and silently
            // discards what it can't parse, so a typo becomes an empty field.
            // Text plus a decimal keypad keeps exactly what was typed.
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={value}
            aria-required="true"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "actualSalePrice-error" : "actualSalePrice-hint"}
            onChange={(e) => {
              setValue(e.target.value);
              setEditedSinceSubmit(true);
            }}
            onBlur={() => setTouched(true)}
          />
          <button
            type="submit"
            className="btn btn-outline btn-sm"
            disabled={pending}
            onClick={() => {
              setTouched(true);
              setEditedSinceSubmit(false);
            }}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="sale-price-error" id="actualSalePrice-error" role="alert">{message}</p>
      ) : !editedSinceSubmit && state?.success ? (
        <p className="sale-price-ok" role="status">{state.success}</p>
      ) : (
        <p className="sale-price-hint" id="actualSalePrice-hint">
          Up to 2 decimal places, and no more than the order amount of {formatINR(orderTotal)}.
          {currentPaise == null && ` ${REQUIRED_MESSAGE}`}
        </p>
      )}
    </form>
  );
}
