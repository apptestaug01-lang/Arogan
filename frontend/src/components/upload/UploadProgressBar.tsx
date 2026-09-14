import React from 'react'
import { uploadTracker } from '../../lib/upload/fileProcessor'

interface UploadProgressBarProps {
  uploadId: string
}

const UploadProgressBar: React.FC<UploadProgressBarProps> = ({ uploadId }) => {
  const { progress, status } = uploadTracker

  const getProgress = () => {
    return progress[uploadId] || 0
  }

  const getStatusMessage = () => {
    return status[uploadId] || 'Uploading...'
  }

  return (
    <div className="upload-progress-container">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${getProgress()}%` }}
        ></div>
      </div>
      <div className="progress-status">
        {getStatusMessage()}
      </div>
    </div>
  )
}

export default UploadProgressBar