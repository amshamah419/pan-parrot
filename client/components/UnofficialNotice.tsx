export function UnofficialNotice() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <p className="container px-4 py-2 text-sm leading-relaxed">
        <strong>Unofficial personal tool.</strong> PAN Parrot is not a Palo
        Alto Networks product or service. It is maintained by one person on
        the public internet, outside corporate infrastructure. Do not send
        secrets, credentials, customer data, or production traffic. Captured
        requests are deleted automatically after a short retention window.
      </p>
    </div>
  );
}
