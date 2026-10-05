import Tracker from "@/components/tracker";

export const metadata = { title: "Your referrals · NxtWave AI Workshop", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Tracker code={code.toUpperCase()} />;
}
