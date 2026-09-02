"use client";

import { Doughnut } from "react-chartjs-2";
import { CHART_COLORS } from "./chartTheme";

const SLICE_COLORS = [
  CHART_COLORS.gold,
  CHART_COLORS.emerald,
  CHART_COLORS.blue,
  CHART_COLORS.violet,
  CHART_COLORS.rose,
  CHART_COLORS.cyan,
  CHART_COLORS.orange,
  CHART_COLORS.red,
];

type TopProductsChartProps = {
  labels: string[];
  values: number[];
};

export default function TopProductsChart({ labels, values }: TopProductsChartProps) {
  const hasData = values.some((v) => v > 0);

  return (
    <Doughnut
      data={{
        labels: hasData ? labels : ["No data"],
        datasets: [
          {
            data: hasData ? values : [1],
            backgroundColor: hasData
              ? labels.map((_, i) => SLICE_COLORS[i % SLICE_COLORS.length])
              : [CHART_COLORS.gray200],
            borderWidth: 0,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            display: hasData,
            position: "bottom",
            labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 14, padding: 12, font: { weight: 600 } },
          },
          tooltip: { enabled: hasData },
        },
      }}
    />
  );
}
