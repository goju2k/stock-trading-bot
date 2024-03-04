import { Flex, LineChart, Text } from '@mint-ui/core';
import { ResponseVolumeRank } from '@shared/apis/kis';

interface MainChartProps {
  data?:ResponseVolumeRank[];
}

export function MainChart({ data }:MainChartProps) {
  return (
    <>{data && data.length > 0 ? (
      <LineChart
        data={data.filter((item) => Number(item.prdy_ctrt) > 0).map(
          (item, idx) => ({
            ...item,
            data_rank: idx + 1,
          }),
        ).slice(0, 15)}
        series={[{
          type: 'PointAndFill', 
          keyY: 'prdy_ctrt',
          lineStyle: { fill: 'lightgreen', fillOpacity: 0.6, stroke: 'lightgreen', strokeWidth: 2 }, 
          pointStyle: { pointSize: 2 },
        }]}
        seriesConfig={{
          keyX: 'data_rank',
          valueUnit: 6, 
          labelY: { renderer: (val) => `${val}%` },
          minValue: 0,
          maxValue: 30,
        }}
        paddingTop={30}
        paddingBottom={30}
        paddingLeft={35}
        paddingRight={10}
      />
    )
      : <Flex flexAlign='center'><Text text='No Data' /></Flex>}
    </>
  );
}