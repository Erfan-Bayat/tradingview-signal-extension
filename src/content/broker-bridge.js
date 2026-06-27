// src/content/broker-bridge.js

import { parsePersianNumber, toAsciiDigits } from "../shared/number-utils.js";

function clickOnText(text, selector) {
  const buttons = Array.from(document.querySelectorAll("button"));
  const el = buttons.find((btn) => (btn.textContent || "").includes(text)) || document.querySelector(selector);
  el?.click();
  return !!el;
}

function inputByPlaceholder(ph) {
  return Array.from(document.querySelectorAll("input")).find((el) => String(el.placeholder || "").includes(ph));
}

export function createBrokerBridge(adapter) {
  return {
    getStatus() {
      const btn = document.querySelector("button.gold-gradient");
      const price = btn ? parsePersianNumber(btn.textContent) : null;
      const loggedIn = !!document.querySelector("a[href*='dashboard'], button") && /واریز|داشبورد|خروج/.test(document.body?.textContent || "");
      return { loggedIn, price };
    },
    placeOrder({ side = "BUY", volume, tpsl = false, takeProfit, stopLoss } = {}) {
      if (!document.querySelector("button.gold-gradient")) throw new Error("PRICE_NOT_READY");
      if (!inputByPlaceholder("حجم")) throw new Error("VOLUME_INPUT_NOT_FOUND");
      if (!clickOnText("خرید") && !clickOnText("فروش")) throw new Error("BUY_SELL_BUTTON_NOT_FOUND");

      const modeBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
        ["لفظ", "اوردر"].includes(btn.textContent || "")
      );
      if (!modeBtn) throw new Error("ORDER_MODE_NOT_FOUND");

      if (modeBtn.textContent.includes("لفظ") === false) {
        modeBtn.click();
      }

      const volumeEl = inputByPlaceholder("حجم");
      if (volumeEl && typeof volume === "number" && Number.isFinite(volume)) {
        volumeEl.value = String(volume);
        volumeEl.dispatchEvent(new Event("input", { bubbles: true }));
      }

      if (side === "BUY") {
        clickOnText("خرید");
      } else {
        clickOnText("فروش");
      }

      if (tpsl) {
        this.setTPSL({ takeProfit, stopLoss });
      }
    },
    setTPSL({ takeProfit, stopLoss } = {}) {
      try {
        const openBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
          (btn.textContent || "").includes("حد سود و ضرر")
        );
        openBtn?.click();
        const tpInput = inputByPlaceholder("حد سود");
        const slInput = inputByPlaceholder("حد ضرر");
        if (tpInput && typeof takeProfit === "number" && Number.isFinite(takeProfit)) {
          tpInput.value = String(takeProfit);
          tpInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (slInput && typeof stopLoss === "number" && Number.isFinite(stopLoss)) {
          slInput.value = String(stopLoss);
          slInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } catch {}
    }
  };
}
