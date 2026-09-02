"use client";

import { Line } from "react-chartjs-2";
import { CHART_COLORS } from "./chartTheme";

type WeekSalesChartProps = {
  labels: string[];
  sales: number[];
  purchases: number[];
};

export default function WeekSalesChart({ labels, sales, purchases }: WeekSalesChartProps) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "Sales",
            data: sales,
            borderColor: CHART_COLORS.gold,
            backgroundColor: "rgba(192,133,26,.12)",
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: CHART_COLORS.gold,
            borderWidth: 2,
          },
          {
            label: "Purchases",
            data: purchases,
            borderColor: CHART_COLORS.emerald,
            backgroundColor: "rgba(16,156,107,.10)",
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: CHART_COLORS.emerald,
            borderWidth: 2,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            align: "center",
            labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 14, padding: 18, font: { weight: 600 } },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => "$ " + v },
            title: { display: true, text: "Amount", font: { weight: 600 } },
            grid: { color: CHART_COLORS.gray100 },
          },
          x: { grid: { color: CHART_COLORS.gray100 } },
        },
      }}
    />
  );
}
