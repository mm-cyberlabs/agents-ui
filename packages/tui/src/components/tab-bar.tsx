import React from "react";
import { Box, Text } from "ink";

interface TabBarProps {
  tabs: string[];
  activeIndex: number;
}

export function TabBar({ tabs, activeIndex }: TabBarProps) {
  return (
    <Box gap={1} borderStyle="single" borderBottom borderColor="gray" paddingX={1}>
      {tabs.map((tab, i) => (
        <Text
          key={tab}
          bold={i === activeIndex}
          color={i === activeIndex ? "cyan" : "gray"}
        >
          [{i + 1}] {tab}
        </Text>
      ))}
    </Box>
  );
}
