'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { toast } from "sonner"
import { useListStore } from '@/stores/listStore';
import Loader from '@/components/loader/Loader';

interface CsvMeta {
  headers: string[];
  rowCount: number;
}

export default function UploadView() {
  const [file, setFile] = useState<File | null>(null);
  const [csvMeta, setCsvMeta] = useState<CsvMeta | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const { addList, setActiveList } = useListStore();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);

      Papa.parse(uploadedFile, {
        header: true,
        preview: 5,
        complete: (result: any) => {
          const headers = result.meta.fields || [];
          setCsvMeta({
            headers,
            rowCount: result.data.length,
          });
        },
      });
    }
  }

  function handleMappingChange(header: string, value: string) {
    setColumnMapping((prev) => ({
      ...prev,
      [header]: value,
    }));
  }

  async function handleSubmit() {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('WhiteSpider Org')
        .upload(`uploads/${Date.now()}_${file.name}`, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('File upload failed');
        setIsUploading(false);
        return;
      }

      // Step 2: Parse the full CSV to count total leads
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (result: any) => {
          const totalLeads = result.data.length;

          // Step 3: Insert into lead_lists table
          const { data: listData, error: insertError } = await supabase
            .from('lead_lists')
            .insert({
              name: file.name.replace('.csv', ''),
              schema: columnMapping,
              status: 'uploaded',
              filepath: uploadData.path,
              total_leads: totalLeads,
              leads_processed: 0,
            })
            .select()
            .single();

          if (insertError) {
            console.error('Insert error:', insertError);
            toast.error('Failed to create list');
            setIsUploading(false);
            return;
          }

          // Step 4: Add to Zustand store and navigate
          addList(listData);
          setActiveList(listData.id);

          toast.success('Upload successful! List created.');
          setIsUploading(false);
        },
        error: (error: any) => {
          console.error('Parse error:', error);
          toast.error('Failed to parse CSV file');
          setIsUploading(false);
        },
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-full p-6 text-white">
      {isUploading && <Loader />}

      {!file ? (
        <div className="flex items-center justify-center flex-1">
          <div className="max-w-2xl w-full">
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-dashed border-gray-600 hover:border-purple-500 transition-colors duration-300 p-12 rounded-2xl text-center shadow-2xl">
              {/* Upload Icon */}
              <div className="mb-6 flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg
                    className="w-12 h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Upload Your Lead List
              </h2>

              {/* Description */}
              <p className="text-gray-400 mb-8 text-lg">
                Drop your CSV file here or click to browse
              </p>

              {/* File Input Button */}
              <label className="inline-block cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                <div className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-semibold text-white transition duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  Choose CSV File
                </div>
              </label>

              {/* Supported Format */}
              <p className="text-gray-500 text-sm mt-6">
                Supported format: <span className="text-purple-400 font-semibold">.csv</span>
              </p>

              {/* Features List */}
              <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center mb-2">
                    <span className="text-purple-400 text-xl">📊</span>
                  </div>
                  <span className="text-gray-400">Auto-detect columns</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-blue-900/30 rounded-full flex items-center justify-center mb-2">
                    <span className="text-blue-400 text-xl">🔄</span>
                  </div>
                  <span className="text-gray-400">Map fields easily</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                    <span className="text-green-400 text-xl">⚡</span>
                  </div>
                  <span className="text-gray-400">Fast import</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-3xl bg-[#1a1a1a] p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">CSV Metadata</h2>
          {csvMeta && (
            <div className="mb-4 text-sm text-gray-300">
              <p>Columns: {csvMeta.headers.join(', ')}</p>
              <p>Rows (sampled): {csvMeta.rowCount}</p>
            </div>
          )}

          <h3 className="text-lg font-semibold mb-2">Map Columns</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {csvMeta?.headers.map((header) => (
              <div key={header} className="flex flex-col">
                <label className="mb-1 text-sm">{header}</label>
                <select
                  className="bg-[#2a2a2a] p-2 rounded-md text-white"
                  value={columnMapping[header] || ''}
                  onChange={(e) =>
                    handleMappingChange(header, e.target.value)
                  }
                  disabled={isUploading}
                >
                  <option value="">-- Select Field --</option>
                  <option value="email">Email</option>
                  <option value="first_name">First Name</option>
                  <option value="last_name">Last Name</option>
                  <option value="phone">Phone</option>
                  <option value="name">Company Name</option>
                  <option value="domain">Domain</option>
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className={`w-full py-2 px-4 rounded-lg transition duration-200 shadow-md ${isUploading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 cursor-pointer'
              }`}
          >
            {isUploading ? 'Uploading...' : 'Start Upload'}
          </button>
        </div>
      )}
    </div>
  )
}