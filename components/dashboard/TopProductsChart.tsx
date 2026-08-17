"use client";

import { Doughnut } from "react-chartjs-2";
import { CHART_COLORS } from "./chartTheme";

export default function TopProductsChart() {
  return (
    <Doughnut
      data={{
        labels: ["No data"],
        datasets: [{ data: [1], backgroundColor: [CHART_COLORS.gray200], borderWidth: 0 }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      }}
    />
  );
}
