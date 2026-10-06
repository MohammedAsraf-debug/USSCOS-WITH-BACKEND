export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="page-loader" role="status" aria-label={label}>
      <span></span>
    </div>
  )
}
