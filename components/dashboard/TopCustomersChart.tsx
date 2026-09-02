"use client";

import { Pie } from "react-chartjs-2";
import { CHART_COLORS } from "./chartTheme";

const SLICE_COLORS = [
  CHART_COLORS.violet,
  CHART_COLORS.gold,
  CHART_COLORS.emerald,
  CHART_COLORS.blue,
  CHART_COLORS.rose,
];

type TopCustomersChartProps = {
  labels: string[];
  values: number[];
};

export default function TopCustomersChart({ labels, values }: TopCustomersChartProps) {
  const hasData = values.some((v) => v > 0);

  return (
    <Pie
      data={{
        labels: hasData ? labels : ["No data"],
        datasets: [
          {
            data: hasData ? values : [1],
            backgroundColor: hasData
              ? labels.map((_, i) => SLICE_COLORS[i % SLICE_COLORS.length])
              : [CHART_COLORS.gray200],
            borderColor: "#fff",
            borderWidth: 3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: hasData,
            position: "top",
            align: "end",
            labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 14, padding: 10, font: { weight: 600 } },
          },
        },
      }}
    />
  );
}
