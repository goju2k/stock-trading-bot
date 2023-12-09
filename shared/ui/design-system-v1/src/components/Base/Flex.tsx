import { Flex as MintFlex, FlexProps } from '@mint-ui/core';
import { Ref, forwardRef } from 'react';

export const Flex = MintFlex;

export const FlexLeft = forwardRef<HTMLDivElement | null, FlexProps>((props: Omit<FlexProps, 'ref'>, ref:Ref<HTMLDivElement | null> | undefined) => <MintFlex ref={ref} flexAlign='left-center' {...props} />);
FlexLeft.displayName = 'FlexLeft';

export const FlexCenter = forwardRef<HTMLDivElement | null, FlexProps>((props: Omit<FlexProps, 'ref'>, ref:Ref<HTMLDivElement | null> | undefined) => <MintFlex ref={ref} flexAlign='center' {...props} />);
FlexCenter.displayName = 'FlexCenter';

export const FlexRight = forwardRef<HTMLDivElement | null, FlexProps>((props: Omit<FlexProps, 'ref'>, ref:Ref<HTMLDivElement | null> | undefined) => <MintFlex ref={ref} flexAlign='right-center' {...props} />);
FlexRight.displayName = 'FlexRight';

export const FlexBetween = forwardRef<HTMLDivElement | null, FlexProps>((props: Omit<FlexProps, 'ref'>, ref:Ref<HTMLDivElement | null> | undefined) => <MintFlex ref={ref} flexAlign='center' justifyContent='space-between' {...props} />);
FlexBetween.displayName = 'FlexBetween';