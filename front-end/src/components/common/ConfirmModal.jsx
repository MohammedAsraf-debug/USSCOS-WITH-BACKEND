import Modal from './Modal.jsx'
import PrimaryButton from './PrimaryButton.jsx'
import SecondaryButton from './SecondaryButton.jsx'

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={loading}>
            {cancelLabel}
          </SecondaryButton>
          <PrimaryButton onClick={onConfirm} disabled={loading}>
            {loading ? 'Working...' : confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      {message && <p>{message}</p>}
    </Modal>
  )
}
