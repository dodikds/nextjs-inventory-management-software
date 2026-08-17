import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

ChartJS.defaults.font.family = "'Hanken Grotesk', sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = "#7A746A";

export const CHART_COLORS = {
  gold: "#C0851A",
  emerald: "#109C6B",
  blue: "#2C7BE0",
  violet: "#6D5BD0",
  rose: "#DD4F88",
  cyan: "#1BA3C2",
  orange: "#DE7A1E",
  red: "#D8473A",
  ink: "#1C1A16",
  gray500: "#7A746A",
  gray300: "#D4CEC3",
  gray200: "#E6E1D8",
  gray100: "#F3F0E9",
};
