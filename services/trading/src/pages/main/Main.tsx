import { Flex, Grid } from '@mint-ui/core';
import { VolumeRank } from '@shared/apis/kis';
import { useState } from 'react';

interface DataType {
  no:number;
  content:string;
}

export function Main() {
  const [ data, setData ] = useState<DataType[]>([]);

  return (
    <Flex style={{ width: '100vw', height: '100vh' }} flexPadding='10px'>
      <Flex flexAlign='center' flexSize='50px'>
        <button onClick={async () => {
          const data = await VolumeRank({
            FID_INPUT_PRICE_1: 2000,
            FID_INPUT_PRICE_2: 40000,
            FID_VOL_CNT: 1000000,
          });
          console.log(data);

          setData(data.output.map((item, idx) => ({
            no: idx + 1,
            content: JSON.stringify(item),
          } as DataType)));
        }}
        >전송
        </button>
      </Flex>
      <Flex>
        <Grid
          headers={[
            { label: 'no', targetId: 'no', width: 50 },
            { label: 'content', targetId: 'content' },
          ]}
          data={data}
          gridStyle={{ emptyText: 'No data' }}
          rowHeightExtensible
        />
      </Flex>
    </Flex>
  );
}