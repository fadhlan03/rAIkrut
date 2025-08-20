declare module 'react-orgchart' {
  import React from 'react';

  interface OrgChartProps {
    tree: any;
    NodeComponent: React.ComponentType<{ node: any }>;
    [key: string]: any;
  }

  const OrgChart: React.ComponentType<OrgChartProps>;
  export default OrgChart;
}