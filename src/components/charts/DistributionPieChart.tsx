import React from 'react';
import ReactECharts from 'echarts-for-react';

interface DistributionPieChartProps {
  title: string;
  data: { name: string; value: number; color?: string }[];
}

export const DistributionPieChart: React.FC<DistributionPieChartProps> = ({ title, data }) => {
  const option = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
        label: { show: false },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: d.color ? { color: d.color } : undefined,
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 220 }} />;
};
