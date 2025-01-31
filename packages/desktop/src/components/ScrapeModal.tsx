import { trpc } from '@/trpc'
import {
  FormControl,
  FormErrorMessage,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  type ModalProps
} from '@chakra-ui/react'
import { Formik } from 'formik'

export default function ScrapeModal({
  onClose,
  ...rest
}: Omit<ModalProps, 'children'>) {
  const mutation = trpc.documents.fromUrl.useMutation()

  async function onSubmit(url: string): Promise<void> {
    await mutation.mutateAsync({ url })
    onClose()
  }

  return (
    <Modal onClose={onClose} {...rest}>
      <ModalOverlay />
      <ModalContent>
        <ModalBody p="0">
          <Formik
            initialValues={{ url: '' }}
            onSubmit={({ url }) => onSubmit(url)}
          >
            {({ handleSubmit, handleChange, values, errors }) => (
              <form onSubmit={handleSubmit}>
                <FormControl>
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    onChange={handleChange}
                    value={values.url}
                    placeholder="Paste your link here"
                    size="lg"
                  />
                  {errors.url && (
                    <FormErrorMessage>{errors.url}</FormErrorMessage>
                  )}
                </FormControl>
              </form>
            )}
          </Formik>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
