import React from 'react';
import ReactECharts from 'echarts-for-react';

interface TopUsageBarChartProps {
  title: string;
  categories: string[];
  values: number[];
  valueLabel: string;
  formatter?: (value: number) => string;
}

export const TopUsageBarChart: React.FC<TopUsageBarChartProps> = ({
  title,
  categories,
  values,
  valueLabel,
  formatter,
}) => {
  const option = {
    title: { text: title, textStyle: { fontSize: 13 } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: formatter,
    },
    grid: { left: 90, right: 20, top: 40, bottom: 20 },
    xAxis: { type: 'value', name: valueLabel },
    yAxis: { type: 'category', data: categories, inverse: true },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: { color: '#06c', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: Math.max(200, categories.length * 32 + 60) }} />;
};
