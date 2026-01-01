import { CreateTokenForm } from '@/components/CreateTokenForm'

export default function CreatePage() {
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Create Your Memecoin</h1>
      <p className="text-gray-400 mb-8">
        Launch a new token on the Cronos blockchain in seconds.
        Your token will trade on a bonding curve until it reaches 500 CRO,
        then automatically graduate to VVS Finance.
      </p>
      <CreateTokenForm />
    </div>
  )
}
