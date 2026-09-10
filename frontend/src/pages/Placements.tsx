import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Placement {
  id: string;
  feeType: string;
  feeValue: string;
  invoiceStatus: string;
  startDate: string;
  job: { title: string; company: { name: string } };
}

export default function Placements() {
  const [placements, setPlacements] = useState<Placement[]>([]);

  useEffect(() => {
    api.get<Placement[]>("/api/placements").then(setPlacements);
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Placements & fees</h1>
      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Fee type</th>
              <th className="px-3 py-2">Fee value</th>
              <th className="px-3 py-2">Invoice status</th>
              <th className="px-3 py-2">Start date</th>
            </tr>
          </thead>
          <tbody>
            {placements.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.job?.title}</td>
                <td className="px-3 py-2">{p.job?.company?.name}</td>
                <td className="px-3 py-2">{p.feeType.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{p.feeValue}</td>
                <td className="px-3 py-2">{p.invoiceStatus.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{new Date(p.startDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
