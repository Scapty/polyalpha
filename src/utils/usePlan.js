import { useState, useCallback } from "react";

const PLANS = {
  free:  { id: "free",  label: "Free",  price: 0 },
  pro:   { id: "pro",   label: "Pro",   price: 19 },
  elite: { id: "elite", label: "Elite", price: 49 },
};

const STORAGE_KEY = "dexio_plan";

function getStoredPlan() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && PLANS[stored]) return stored;
  } catch {}
  return "free";
}

export function usePlan() {
  const [plan, setPlanState] = useState(getStoredPlan);

  const setPlan = useCallback((newPlan) => {
    if (PLANS[newPlan]) {
      localStorage.setItem(STORAGE_KEY, newPlan);
      setPlanState(newPlan);
    }
  }, []);

  return {
    plan,          // "free" | "pro" | "elite"
    setPlan,
    isPro: plan === "pro" || plan === "elite",
    isElite: plan === "elite",
    planData: PLANS[plan],
    PLANS,
  };
}
