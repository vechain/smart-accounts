import {
  Box,
  Card,
  HStack,
  Heading,
  SegmentGroup,
  SimpleGrid,
  Separator,
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
import { useInsights } from "../../../../hooks/useInsights";

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
type Granularity = "daily" | "weekly" | "monthly";

const PERIOD_CONFIG: Record<
  Period,
  { granularity: Granularity; take: number | null; description: string }
> = {
  "1M": { granularity: "daily", take: 30, description: "Daily, last 30 days" },
  "3M": { granularity: "weekly", take: 13, description: "Weekly, last 13 weeks" },
  "1Y": { granularity: "monthly", take: 12, description: "Monthly, last 12 months" },
  All: { granularity: "monthly", take: null, description: "Monthly, full history" },
};

const SHORT_MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatTick = (key: string, g: Granularity): string => {
  if (g === "monthly") {
    const [y, m] = key.split("-");
    return `${SHORT_MONTH[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  }
  // daily / weekly: YYYY-MM-DD
  const [, m, d] = key.split("-");
  return `${SHORT_MONTH[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
};

const formatBucketLabel = (key: string, g: Granularity): string => {
  if (g === "monthly") {
    const [y, m] = key.split("-");
    return `${SHORT_MONTH[parseInt(m, 10) - 1]} ${y}`;
  }
  const [y, m, d] = key.split("-");
  const base = `${SHORT_MONTH[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  return g === "weekly" ? `Week of ${base}` : base;
};

export const NetworkInsights = () => {
  const { data } = useInsights("mainnet");
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

  const { chartData, granularity, chartDescription } = useMemo(() => {
    const cfg = PERIOD_CONFIG[period];
    const series = data.series[cfg.granularity];
    const rows = cfg.take == null ? series : series.slice(-cfg.take);
    return {
      chartData: rows,
      granularity: cfg.granularity,
      chartDescription: cfg.description,
    };
  }, [period, data.series]);

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
                <VStack align="flex-start" gap={0.5}>
                  <Heading size="sm" letterSpacing="-0.02em">
                    Accounts created
                  </Heading>
                  <Text textStyle="xs" color="text.subtle">
                    {chartDescription}
                  </Text>
                </VStack>
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
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={graphGrid}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="key"
                      tick={{ fill: graphAxis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={
                        granularity === "daily"
                          ? 24
                          : granularity === "weekly"
                            ? 12
                            : 0
                      }
                      tickFormatter={(k: string) => formatTick(k, granularity)}
                    />
                    <YAxis
                      tick={{ fill: graphAxis, fontSize: 11 }}
                      tickFormatter={(v: number) => formatCompact(v)}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                      cursor={{ fill: graphGrid }}
                      labelFormatter={(k: string) =>
                        formatBucketLabel(k, granularity)
                      }
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

      {data.treasury && (
        <>
          <Card.Root>
            <Card.Body p={6}>
              <VStack align="stretch" gap={5}>
                <HStack justify="space-between" align="baseline">
                  <Heading size="sm" letterSpacing="-0.02em">
                    Fleet treasury
                  </Heading>
                  <Text textStyle="xs" color="text.subtle">
                    Across {formatCount(data.treasury.accountsCounted)} accounts
                  </Text>
                </HStack>

                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  {(["b3tr", "vot3", "vet", "vtho"] as const).map((k) => (
                    <TreasuryStat
                      key={k}
                      label={k.toUpperCase()}
                      total={formatToken(data.treasury!.fleet.totals[k])}
                      holders={data.treasury!.fleet.holders[k]}
                    />
                  ))}
                </SimpleGrid>

                <Separator borderColor="border.subtle" />

                <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                  {(
                    [
                      { key: "nativeV3", label: "Native V3", color: graphV3 },
                      {
                        key: "upgradedV1ToV3",
                        label: "Upgraded V1 → V3",
                        color: graphUpgraded,
                      },
                      { key: "stillV1", label: "Still V1", color: graphV1 },
                    ] as const
                  ).map(({ key, label, color }) => {
                    const v = data.treasury!.byVersion[key];
                    return (
                      <VStack key={key} align="stretch" gap={2}>
                        <HStack gap={2}>
                          <Box boxSize="8px" rounded="full" bg={color} />
                          <Text
                            textStyle="xs"
                            textTransform="uppercase"
                            letterSpacing="0.1em"
                            color="text.subtle"
                            fontWeight={600}
                          >
                            {label}
                          </Text>
                        </HStack>
                        <Text textStyle="sm" color="text.muted">
                          B3TR{" "}
                          <Text
                            as="span"
                            color="text.primary"
                            fontFamily="mono"
                            fontWeight={600}
                          >
                            {formatToken(v.totals.b3tr)}
                          </Text>
                        </Text>
                        <Text textStyle="sm" color="text.muted">
                          VOT3{" "}
                          <Text
                            as="span"
                            color="text.primary"
                            fontFamily="mono"
                            fontWeight={600}
                          >
                            {formatToken(v.totals.vot3)}
                          </Text>
                        </Text>
                        <Text textStyle="sm" color="text.muted">
                          VET{" "}
                          <Text
                            as="span"
                            color="text.primary"
                            fontFamily="mono"
                            fontWeight={600}
                          >
                            {formatToken(v.totals.vet)}
                          </Text>
                        </Text>
                      </VStack>
                    );
                  })}
                </SimpleGrid>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body p={6}>
              <VStack align="stretch" gap={5}>
                <Heading size="sm" letterSpacing="-0.02em">
                  Activity tiers
                </Heading>
                <Text textStyle="xs" color="text.muted">
                  Hot = ≥ 1 B3TR / VOT3 or ≥ 10 VET · Warm = any asset · Cold =
                  empty
                </Text>

                <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                  {(
                    [
                      { key: "nativeV3", label: "Native V3" },
                      { key: "upgradedV1ToV3", label: "Upgraded V1 → V3" },
                      { key: "stillV1", label: "Still V1" },
                    ] as const
                  ).map(({ key, label }) => {
                    const v = data.treasury!.byVersion[key];
                    const total = v.tiers.hot + v.tiers.warm + v.tiers.cold;
                    const pct = (n: number) =>
                      total > 0 ? (n * 100) / total : 0;
                    return (
                      <VStack key={key} align="stretch" gap={3}>
                        <HStack justify="space-between" align="baseline">
                          <Text
                            textStyle="xs"
                            textTransform="uppercase"
                            letterSpacing="0.1em"
                            color="text.subtle"
                            fontWeight={600}
                          >
                            {label}
                          </Text>
                          <Text textStyle="xs" color="text.subtle">
                            {formatCount(total)}
                          </Text>
                        </HStack>
                        <HStack
                          h="8px"
                          rounded="full"
                          overflow="hidden"
                          bg="bg.chip"
                          gap={0}
                        >
                          <Box
                            h="full"
                            w={`${pct(v.tiers.hot)}%`}
                            bg={graphV3}
                          />
                          <Box
                            h="full"
                            w={`${pct(v.tiers.warm)}%`}
                            bg={graphUpgraded}
                          />
                          <Box
                            h="full"
                            w={`${pct(v.tiers.cold)}%`}
                            bg="text.subtle"
                            opacity={0.4}
                          />
                        </HStack>
                        <HStack justify="space-between" textStyle="xs">
                          <TierLabel
                            dot={graphV3}
                            label="Hot"
                            value={v.tiers.hot}
                          />
                          <TierLabel
                            dot={graphUpgraded}
                            label="Warm"
                            value={v.tiers.warm}
                          />
                          <TierLabel
                            dot="text.subtle"
                            label="Cold"
                            value={v.tiers.cold}
                            dim
                          />
                        </HStack>
                      </VStack>
                    );
                  })}
                </SimpleGrid>
              </VStack>
            </Card.Body>
          </Card.Root>
        </>
      )}
    </VStack>
  );
};

const TierLabel = ({
  dot,
  label,
  value,
  dim,
}: {
  dot: string;
  label: string;
  value: number;
  dim?: boolean;
}) => (
  <HStack gap={1.5}>
    <Box boxSize="6px" rounded="full" bg={dot} opacity={dim ? 0.5 : 1} />
    <Text color="text.muted">
      {label}{" "}
      <Text as="span" color="text.primary" fontFamily="mono" fontWeight={600}>
        {value.toLocaleString()}
      </Text>
    </Text>
  </HStack>
);

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
