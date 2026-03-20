import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getClientsForProcessing, getProductsForProcessing } from '../../actions'
import { ProcessingForm } from '../components/processing-form'

export default async function NewProcessingReportPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'prison') redirect('/prison/login')

  const clients = await getClientsForProcessing()
  const products = await getProductsForProcessing()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ProcessingForm clients={clients} products={products} />
    </div>
  )
}
