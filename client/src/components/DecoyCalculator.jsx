import { useState } from "react";

/**
 * DecoyCalculator
 * -----------------------------------------------------------
 * Genuinely-functional calculator disguise.
 * Full-screen, mobile-ergonomic, safe-area aware.
 *
 * Re-entry codes:
 * Typing 112 = OR 8042 = instantly and silently restores the Suraksha Shadow app.
 */
function useCalculator(onUnlock) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState(null);
  const [operator, setOperator] = useState(null);
  const [overwrite, setOverwrite] = useState(true);
  const [sequence, setSequence] = useState("");

  const reset = () => {
    setDisplay("0");
    setStored(null);
    setOperator(null);
    setOverwrite(true);
    setSequence("");
  };

  const pressDigit = (d) => {
    setSequence((s) => s + d);
    setDisplay((cur) => {
      if (overwrite) return d;
      if (cur === "0") return d;
      if (cur.length >= 9) return cur;
      return cur + d;
    });
    setOverwrite(false);
  };

  const pressDecimal = () => {
    setSequence((s) => s + ".");
    setDisplay((cur) => {
      if (overwrite) return "0.";
      if (cur.includes(".")) return cur;
      return cur + ".";
    });
    setOverwrite(false);
  };

  const pressOperator = (op) => {
    setSequence((s) => s + op);
    setStored(parseFloat(display));
    setOperator(op);
    setOverwrite(true);
  };

  const compute = (a, b, op) => {
    switch (op) {
      case "+":
        return a + b;
      case "−":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  const trimNumber = (n) => {
    const s = n.toPrecision(10).replace(/\.?0+$/, "");
    return s.length > 10 ? n.toExponential(4) : s;
  };

  const pressEquals = () => {
    const isCode =
      display === "112" ||
      display === "8042" ||
      sequence === "112" ||
      sequence === "8042" ||
      sequence.endsWith("112") ||
      sequence.endsWith("8042");

    if (isCode) {
      reset();
      onUnlock();
      return;
    }
    if (operator && stored !== null) {
      const result = compute(stored, parseFloat(display), operator);
      setDisplay(Number.isNaN(result) ? "Error" : trimNumber(result));
      setStored(null);
      setOperator(null);
      setOverwrite(true);
      setSequence("");
    }
  };

  const pressClear = () => reset();

  const pressToggleSign = () => {
    setDisplay((cur) => (cur.startsWith("-") ? cur.slice(1) : cur === "0" ? cur : "-" + cur));
  };

  const pressBackspace = () => {
    setSequence((s) => (s.length > 0 ? s.slice(0, -1) : ""));
    setDisplay((cur) => {
      if (overwrite || cur.length <= 1 || (cur.length === 2 && cur.startsWith("-"))) return "0";
      return cur.slice(0, -1);
    });
  };

  return { display, pressDigit, pressDecimal, pressOperator, pressEquals, pressClear, pressToggleSign, pressBackspace };
}

const BUTTON_TONES = {
  num: { bg: "#282a32", color: "#e1e1ed" },
  op: { bg: "#e8c468", color: "#241a00" },
  fn: { bg: "#434653", color: "#e1e1ed" },
};

function Btn({ children, onClick, wide, tone = "num" }) {
  const t = BUTTON_TONES[tone] || BUTTON_TONES.num;
  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: wide ? "span 2" : "span 1",
        background: t.bg,
        color: t.color,
        border: "none",
        borderRadius: 999,
        fontSize: "clamp(20px, 5.5vw, 28px)",
        fontWeight: 500,
        padding: "clamp(12px, 3.5vw, 18px) 0",
        textAlign: wide ? "left" : "center",
        paddingLeft: wide ? "clamp(20px, 6vw, 32px)" : 0,
        cursor: "pointer",
        transition: "opacity 0.1s ease, transform 0.08s ease",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        minHeight: "clamp(52px, 12vw, 70px)",
      }}
    >
      {children}
    </button>
  );
}

export default function DecoyCalculator({ onUnlock }) {
  const calc = useCalculator(onUnlock);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "max(20px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)) 16px",
        boxSizing: "border-box",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        zIndex: 99999,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          height: "100%",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: "clamp(44px, 13vw, 72px)",
            fontWeight: 300,
            textAlign: "right",
            padding: "0 12px clamp(12px, 3vh, 28px)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {calc.display}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "clamp(8px, 2.5vw, 14px)" }}>
          <Btn tone="fn" onClick={calc.pressClear}>AC</Btn>
          <Btn tone="fn" onClick={calc.pressToggleSign}>+/−</Btn>
          <Btn tone="fn" onClick={calc.pressBackspace}>⌫</Btn>
          <Btn tone="op" onClick={() => calc.pressOperator("÷")}>÷</Btn>

          <Btn onClick={() => calc.pressDigit("7")}>7</Btn>
          <Btn onClick={() => calc.pressDigit("8")}>8</Btn>
          <Btn onClick={() => calc.pressDigit("9")}>9</Btn>
          <Btn tone="op" onClick={() => calc.pressOperator("×")}>×</Btn>

          <Btn onClick={() => calc.pressDigit("4")}>4</Btn>
          <Btn onClick={() => calc.pressDigit("5")}>5</Btn>
          <Btn onClick={() => calc.pressDigit("6")}>6</Btn>
          <Btn tone="op" onClick={() => calc.pressOperator("−")}>−</Btn>

          <Btn onClick={() => calc.pressDigit("1")}>1</Btn>
          <Btn onClick={() => calc.pressDigit("2")}>2</Btn>
          <Btn onClick={() => calc.pressDigit("3")}>3</Btn>
          <Btn tone="op" onClick={() => calc.pressOperator("+")}>+</Btn>

          <Btn wide onClick={() => calc.pressDigit("0")}>0</Btn>
          <Btn onClick={calc.pressDecimal}>.</Btn>
          <Btn tone="op" onClick={calc.pressEquals}>=</Btn>
        </div>
      </div>
    </div>
  );
}