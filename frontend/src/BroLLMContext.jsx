import React, { createContext, useContext, useState } from "react";

const BroLLMContext = createContext();

export function BroLLMProvider({ children }) {
  const [showBroLLM, setShowBroLLM] = useState(false);
  return (
    <BroLLMContext.Provider value={{ showBroLLM, setShowBroLLM }}>
      {children}
    </BroLLMContext.Provider>
  );
}

export function useBroLLM() {
  return useContext(BroLLMContext);
}
