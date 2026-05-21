import {
  Box,
  Card,
  HStack,
  Heading,
  SegmentGroup,
  SimpleGrid,
  Separator,
  Stack,
  Text,
  useToken,
  VStack,
} from "@chakra-ui/react";
import { useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeading } from "../../../../components";
import { useColorModeValue } from "../../../../components/ui/color-mode";
import insightsData from "../../../../data/insights-mainnet.json";

type Insights = typeof insightsData;

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatCount = (n: number) => n.toLocaleString();
const formatCompact = (n: number) => compactFormatter.format(n);
const formatPercent = (n: number) => `${n.toFixed(1)}%`;

const formatToken = (wei: string, decimals = 18, fractionDigits = 2): string => {
  const v = BigInt(wei);
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const fracStr = (v % base).toString().padStart(decimals, "0");
  const frac = fracStr.slice(0, fractionDigits).replace(/0+$/, "");
  const wholeStr = Number(whole).toLocaleString();
  return frac ? `${wholeStr}.${frac}` : wholeStr;
};

type Period = "1M" | "3M" | "1Y" | "All";
const PERIOD_MONTHS: Record<Period, number | null> = {
  "1M": 1,
  "3M": 3,
  "1Y": 12,
  All: null,
};

export const NetworkInsights = () => {
  const data = insightsData as Insights;
  const [period, setPeriod] = useState<Period>("All");

  const [graphV3, graphUpgraded, graphV1, graphGrid, graphAxis] = useToken(
    "colors",
    [
      "graph.v3",
      "graph.upgraded",
      "graph.v1",
      "graph.grid",
      "graph.axis",
    ]
  );

  const tooltipBg = useColorModeValue("white", "#0A0E1A");
  const tooltipBorder = useColorModeValue(
    "rgba(15,23,42,0.08)",
    "rgba(255,255,255,0.08)"
  );
  const tooltipColor = useColorModeValue("#0F172A", "rgba(255,255,255,0.92)");

  const versionPie = [
    { name: "Native V3", value: data.totals.nativeV3, color: graphV3 },
    {
      name: "Upgraded V1 → V3",
      value: data.totals.upgradedV1ToV3,
      color: graphUpgraded,
    },
    { name: "Still V1", value: data.totals.stillV1, color: graphV1 },
  ].filter((d) => d.value > 0);

  const periodMonths = useMemo(() => {
    const limit = PERIOD_MONTHS[period];
    return limit == null ? data.monthly : data.monthly.slice(-limit);
  }, [period, data.monthly]);

  const generatedDate = new Date(data.generatedAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" }
  );

  const tooltipContentStyle = {
    background: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 12,
    fontSize: 12,
    color: tooltipColor,
    boxShadow: "0 12px 32px -12px rgba(0,0,0,0.4)",
  } as const;
  const tooltipItemStyle = { color: tooltipColor } as const;
  const tooltipLabelStyle = { color: tooltipColor } as const;

  return (
    <VStack align="stretch" gap={5}>
      <SectionHeading
        eyebrow="Network insights"
        title="Mainnet account fleet"
        description={`Snapshot at block ${data.snapshotBlock.toLocaleString()} (${generatedDate}). Pre-aggregated from on-chain analytics.`}
      />

      <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
        <StatCard
          label="Total accounts"
          value={formatCount(data.totals.total)}
        />
        <StatCard
          label="V3 adoption"
          value={formatPercent(data.totals.v3AdoptionPercent)}
          hint={`${formatCount(
            data.totals.nativeV3 + data.totals.upgradedV1ToV3
          )} on V3`}
          accent="brand"
        />
        <StatCard
          label="Upgraded V1 → V3"
          value={formatCount(data.totals.upgradedV1ToV3)}
          accent="accent"
        />
        <StatCard
          label="Still V1"
          value={formatCount(data.totals.stillV1)}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 5 }} gap={4}>
        <Card.Root gridColumn={{ base: "auto", lg: "span 2" }}>
          <Card.Body p={6}>
            <VStack align="stretch" gap={4} h="full">
              <Heading size="sm" letterSpacing="-0.02em">
                Version distribution
              </Heading>
              <Box flex={1} minH="240px">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={versionPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={96}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {versionPie.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                      formatter={(v: number) => formatCount(v)}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{
                        fontSize: 12,
                        color: tooltipColor,
                        paddingTop: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root gridColumn={{ base: "auto", lg: "span 3" }}>
          <Card.Body p={6}>
            <VStack align="stretch" gap={4} h="full">
              <HStack
                justify="space-between"
                align={{ base: "stretch", md: "center" }}
                flexDir={{ base: "column", md: "row" }}
                gap={3}
              >
                <Heading size="sm" letterSpacing="-0.02em">
                  Accounts created per month
                </Heading>
                <SegmentGroup.Root
                  size="sm"
                  value={period}
                  onValueChange={(e) => setPeriod(e.value as Period)}
                  borderRadius="lg"
                >
                  <SegmentGroup.Indicator borderRadius="lg" />
                  {(["1M", "3M", "1Y", "All"] as Period[]).map((item) => (
                    <SegmentGroup.Item key={item} value={item}>
                      <SegmentGroup.ItemText>{item}</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                  ))}
                </SegmentGroup.Root>
              </HStack>
              <Box flex={1} minH="240px">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={periodMonths}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={graphGrid}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: graphAxis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: graphAxis, fontSize: 11 }}
                      tickFormatter={(v: number) => formatCompact(v)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                      cursor={{ fill: graphGrid }}
                      formatter={(v: number, name: string) => [
                        formatCount(v),
                        name === "v3Originated"
                          ? "Born V3"
                          : name === "v1Originated"
                            ? "Born V1"
                            : name,
                      ]}
                    />
                    <Bar
                      dataKey="v1Originated"
                      stackId="a"
                      fill={graphV1}
                    />
                    <Bar
                      dataKey="v3Originated"
                      stackId="a"
                      fill={graphV3}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {data.stillV1Treasury && (
        <Card.Root>
          <Card.Body p={6}>
            <VStack align="stretch" gap={5}>
              <HStack justify="space-between" align="baseline">
                <Heading size="sm" letterSpacing="-0.02em">
                  Assets stuck in V1 accounts
                </Heading>
                <Text textStyle="xs" color="text.subtle">
                  {formatCount(data.stillV1Treasury.accounts)} accounts
                </Text>
              </HStack>

              <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                <TreasuryStat
                  label="VET"
                  total={formatToken(data.stillV1Treasury.totals.vet)}
                  holders={data.stillV1Treasury.holders.vet}
                />
                <TreasuryStat
                  label="B3TR"
                  total={formatToken(data.stillV1Treasury.totals.b3tr)}
                  holders={data.stillV1Treasury.holders.b3tr}
                />
                <TreasuryStat
                  label="VOT3"
                  total={formatToken(data.stillV1Treasury.totals.vot3)}
                  holders={data.stillV1Treasury.holders.vot3}
                />
                <TreasuryStat
                  label="VTHO"
                  total={formatToken(data.stillV1Treasury.totals.vtho)}
                  holders={data.stillV1Treasury.holders.vtho}
                />
              </SimpleGrid>

              <Separator borderColor="border.subtle" />

              <Stack direction={{ base: "column", sm: "row" }} gap={6}>
                <Box>
                  <Text textStyle="xs" color="text.subtle">
                    With any asset
                  </Text>
                  <Text
                    fontWeight={700}
                    color="text.primary"
                    fontFamily="mono"
                    fontSize="lg"
                  >
                    {formatCount(data.stillV1Treasury.holders.any)}
                  </Text>
                </Box>
                <Box>
                  <Text textStyle="xs" color="text.subtle">
                    Empty
                  </Text>
                  <Text
                    fontWeight={700}
                    color="text.primary"
                    fontFamily="mono"
                    fontSize="lg"
                  >
                    {formatCount(data.stillV1Treasury.holders.empty)}
                  </Text>
                </Box>
              </Stack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
};

const StatCard = ({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "brand" | "accent";
}) => {
  const accentColor =
    accent === "brand"
      ? "brand.400"
      : accent === "accent"
        ? "accent.400"
        : "text.primary";
  return (
    <Card.Root>
      <Card.Body p={5}>
        <VStack align="stretch" gap={2}>
          <Text
            textStyle="xs"
            textTransform="uppercase"
            letterSpacing="0.12em"
            color="text.subtle"
            fontWeight={600}
          >
            {label}
          </Text>
          <Text
            fontSize="3xl"
            fontWeight={800}
            letterSpacing="-0.03em"
            fontFamily="mono"
            lineHeight="1"
            color={accentColor}
          >
            {value}
          </Text>
          {hint && (
            <Text textStyle="xs" color="text.muted">
              {hint}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

const TreasuryStat = ({
  label,
  total,
  holders,
}: {
  label: string;
  total: string;
  holders: number;
}) => (
  <VStack align="stretch" gap={1}>
    <Text
      textStyle="xs"
      color="text.subtle"
      textTransform="uppercase"
      letterSpacing="0.12em"
      fontWeight={600}
    >
      {label}
    </Text>
    <Text
      fontSize="2xl"
      fontWeight={800}
      letterSpacing="-0.03em"
      fontFamily="mono"
    >
      {total}
    </Text>
    <Text textStyle="xs" color="text.muted">
      {formatCount(holders)} holders
    </Text>
  </VStack>
);
