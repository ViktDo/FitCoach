export const metadata = {
  title: 'Политика ПДн · FitCoach',
  description: 'Политика обработки персональных данных FitCoach',
};
export const dynamic = 'force-static';

export default function PdnPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-3xl bg-white shadow rounded-2xl m-4 p-4">
        <h1 className="text-xl font-semibold mb-3">Политика ПДн</h1>
        <iframe
          src="/docs/pdn-policy.html"
          className="w-full h-[80vh] border rounded-lg"
          title="Политика ПДн"
        />
      </div>
    </main>
  );
}