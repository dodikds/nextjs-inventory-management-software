"use client";

import { Line } from "react-chartjs-2";
import { CHART_COLORS } from "./chartTheme";

const DATES = [
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-23",
  "2026-05-24",
  "2026-05-25",
  "2026-05-26",
];

export default function WeekSalesChart() {
  return (
    <Line
      data={{
        labels: DATES,
        datasets: [
          {
            label: "Sales",
            data: [0, 0, 0, 0, 0, 0, 0],
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
            data: [0, 0, 0, 0, 0, 0, 0],
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
            suggestedMax: 1,
            ticks: { callback: (v) => "$ " + v, stepSize: 0.1 },
            title: { display: true, text: "Amount", font: { weight: 600 } },
            grid: { color: CHART_COLORS.gray100 },
          },
          x: { grid: { color: CHART_COLORS.gray100 } },
        },
      }}
    />
  );
}
