'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { toast } from "sonner"

interface CsvMeta {
  headers: string[];
  rowCount: number;
}

export default function UploadView() {
    const [file, setFile] = useState<File | null>(null);
    const [csvMeta, setCsvMeta] = useState<CsvMeta | null>(null);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    console.log(columnMapping, 'column mapping');

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
    const {data, error} = await supabase.storage
      .from('WhiteSpider Org')
      .upload(`uploads/${file!.name}`, file!, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.log(error, 'error');
      toast.error(
        "Upload Failed"
      );
      return;
    } else {
      toast.success('Upload successful');
      console.log(data, 'data');

      const {data, error} = await supabase.from('lead_lists').insert({
        
      })
    }


  //   const requiredFields = ["email", "first_name", "last_name"];
  //   const missing = requiredFields.filter(
  //       (field) => !Object.values(columnMapping).includes(field)
  //   );

  //   if (missing.length > 0) {
  //       alert(`Missing required mappings: ${missing.join(", ")}`);
  //       return;
  //   }

  // if (!file) return;

  // // Parse full file
  // Papa.parse(file, {
  //   header: true,
  //   skipEmptyLines: true,
  //   complete: async (result: any) => {
  //       // console.log(result, 'result');
  //       const mappedData = result.data.slice(0, 100).map((row: any) => {
  //       const email = row[getHeaderFor("email") as string];
  //       const firstName = row[getHeaderFor("first_name")as string];
  //       const lastName = row[getHeaderFor("last_name")as string];

  //       // everything else into json
  //       const extraData: Record<string, any> = {};
  //       for (const header of csvMeta.headers) {
  //           const mapped = columnMapping[header]; // might be undefined or ''
  //           // skip columns that map to required fields (we already extracted them)
  //           if (mapped && requiredFields.includes(mapped)) continue;
  
  //           // choose key: mapped name if provided, else normalized csv header
  //           const key = (mapped && mapped.length) ? mapped : header;
  
  //           const rawVal = row[header];
  //           // skip empty values to keep JSON small
  //           if (rawVal === undefined || rawVal === null) continue;
  //           const val = (typeof rawVal === 'string') ? rawVal.trim() : rawVal;
  //           if (val === '') continue;
  
  //           extraData[key] = val;
  //         }

  //       console.log(extraData, 'extra Data');

  //       return {
  //         email,
  //         first_name: firstName,
  //         last_name: lastName,
  //         custom_fields: extraData,
  //       };
  //     });

  //     try {
  //       const { data, error } = await supabase
  //         .from("leads")
  //         .insert(mappedData);

  //       if (error) throw error;
  //       toast.success(
  //           "Upload Successfull"
  //       );
  //     } catch (err: any) {
  //       toast.error(
  //           "Upload Failed"
  //       );
  //     }
  //   },
  // });
  }

  function getHeaderFor(field: string) {
    return Object.keys(columnMapping).find(
      (header) => columnMapping[header] === field
    );
  }

  return (
    <div className="flex flex-col h-full p-6 text-white">
      {!file ? (
        <div className="border-2 border-dashed border-gray-600 p-8 rounded-lg text-center">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="mb-4"
          />
          <p className="text-gray-400">Upload a CSV file to begin</p>
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
                >
                  <option value="">-- Select Field --</option>
                  <option value="email">Email</option>
                  <option value="first_name">First Name</option>
                  <option value="last_name">Last Name</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-green-600 to-teal-600 
                       hover:from-green-500 hover:to-teal-500 transition duration-200 shadow-md cursor-pointer"
          >
            Start Upload
          </button>
        </div>
      )}
    </div>
  )
}