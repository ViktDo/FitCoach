export const metadata = {
  title: 'Публичная оферта · FitCoach',
  description: 'Публичная оферта сервиса FitCoach',
};
export const dynamic = 'force-static'; // безопасно для SSG

export default function OfferDocPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-3xl bg-white shadow rounded-2xl m-4 p-4">
        <h1 className="text-xl font-semibold mb-3">Публичная оферта</h1>
        <iframe
          src="/docs/offer.html"
          className="w-full h-[80vh] border rounded-lg"
          title="Публичная оферта"
        />
      </div>
    </main>
  );
}