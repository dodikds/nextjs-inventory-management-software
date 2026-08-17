"use client";

import { Pie } from "react-chartjs-2";
import { CHART_COLORS } from "./chartTheme";

export default function TopCustomersChart() {
  return (
    <Pie
      data={{
        labels: ["direct-customer"],
        datasets: [{ data: [100], backgroundColor: [CHART_COLORS.violet], borderColor: "#fff", borderWidth: 3 }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 14, padding: 10, font: { weight: 600 } },
          },
        },
      }}
    />
  );
}
