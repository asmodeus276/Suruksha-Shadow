import { useState } from "react";

/**
 * DecoyCalculator
 * -----------------------------------------------------------
 * Genuinely-functional calculator. Renders full-screen in place
 * of the real app while decoy mode is active.
 *
 * Re-entry: typing 1, 1, 2, then "=" with no operator pressed in
 * between silently calls onUnlock() instead of computing 112.
 * No dialog, no sound, no visual tell — it should look exactly
 * like someone fat-fingered a sum.
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
    if (sequence === "112") {
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
    setDisplay((cur) => {
      if (overwrite || cur.length <= 1 || (cur.length === 2 && cur.startsWith("-"))) return "0";
      return cur.slice(0, -1);
    });
  };

  return { display, pressDigit, pressDecimal, pressOperator, pressEquals, pressClear, pressToggleSign, pressBackspace };
}

const BUTTON_TONES = {
  num: { bg: "#3A3A3C", color: "#F5F5F5" },
  op: { bg: "#E8935B", color: "#1A1206" },
  fn: { bg: "#A5A5A5", color: "#1A1A1A" },
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
        fontSize: 26,
        fontWeight: 500,
        padding: "18px 0",
        textAlign: wide ? "left" : "center",
        paddingLeft: wide ? 28 : 0,
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
        padding: "24px 14px 20px",
        boxSizing: "border-box",
        fontFamily: "-apple-system, Helvetica, Arial, sans-serif",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          color: "#fff",
          fontSize: 64,
          fontWeight: 300,
          textAlign: "right",
          padding: "0 12px 24px",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {calc.display}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
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
  );
}