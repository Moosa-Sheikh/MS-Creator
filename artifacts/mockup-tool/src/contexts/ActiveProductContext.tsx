import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useGetProduct } from "@workspace/api-client-react";

export type ActiveProduct = {
  id: string;
  name: string;
  description: string | null;
};

type ActiveProductContextValue = {
  activeProduct: ActiveProduct | null;
  setActiveProductId: (id: string | null) => void;
  clearActiveProduct: () => void;
};

const ActiveProductContext = createContext<ActiveProductContextValue | null>(null);

const STORAGE_KEY = "activeProductId";

function ActiveProductLoader({
  id,
  onLoad,
  onNotFound,
}: {
  id: string;
  onLoad: (p: ActiveProduct) => void;
  onNotFound: () => void;
}) {
  const { data, isError } = useGetProduct(id);

  useEffect(() => {
    if (data) {
      onLoad({ id: data.id, name: data.name, description: data.description ?? null });
    }
  }, [data]);

  useEffect(() => {
    if (isError) {
      onNotFound();
    }
  }, [isError]);

  return null;
}

export function ActiveProductProvider({ children }: { children: ReactNode }) {
  const [storedId, setStoredId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(null);

  const setActiveProductId = (id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
      setStoredId(id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setStoredId(null);
      setActiveProduct(null);
    }
  };

  const clearActiveProduct = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStoredId(null);
    setActiveProduct(null);
  };

  return (
    <ActiveProductContext.Provider value={{ activeProduct, setActiveProductId, clearActiveProduct }}>
      {storedId && !activeProduct && (
        <ActiveProductLoader
          id={storedId}
          onLoad={(p) => setActiveProduct(p)}
          onNotFound={() => {
            clearActiveProduct();
          }}
        />
      )}
      {children}
    </ActiveProductContext.Provider>
  );
}

export function useActiveProduct() {
  const ctx = useContext(ActiveProductContext);
  if (!ctx) throw new Error("useActiveProduct must be used within ActiveProductProvider");
  return ctx;
}
