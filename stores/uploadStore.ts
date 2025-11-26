import { create } from "zustand";
import { persist } from 'zustand/middleware'

interface UploadState {
  step: "idle" | "mapping" | "uploading" | "done";
  file: File | null;
  columns: string[];
  mapping: Record<string, string>;
  progress: number;

  setFile: (file: File) => void;
  setColumns: (cols: string[]) => void;
  setMapping: (map: Record<string, string>) => void;
  setStep: (step: UploadState["step"]) => void;
  setProgress: (val: number) => void;
}

export const useUploadStore = create<UploadState>()(
    persist(
        (set) => ({
        step: "idle",
        file: null,
        columns: [],
        mapping: {},
        progress: 0,

        setFile: (file) => set({ file }),
        setColumns: (cols) => set({ columns: cols }),
        setMapping: (map) => set({ mapping: map }),
        setStep: (step) => set({ step }),
        setProgress: (val) => set({ progress: val }),
    }),
    {
        name: 'upload-store'
    })
);
