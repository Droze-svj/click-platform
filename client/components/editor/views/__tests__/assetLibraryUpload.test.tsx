/**
 * "Upload image" posted to /video/upload as a `video` field — a 400 for every
 * image. Images now go to /assets/images as `image`, uploaded images are
 * listed from the server, and dropping a file uploads it (dropping used to
 * toast "Ingesting N file(s)" and do nothing).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import AssetLibraryView from '../AssetLibraryView'
import * as api from '../../../../lib/api'

jest.mock('../../../../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}))

const mGet = api.apiGet as jest.Mock
const mPost = api.apiPost as jest.Mock

function props(showToast = jest.fn()) {
  return { currentTime: 0, videoDuration: 10, setTimelineSegments: jest.fn(), showToast }
}

beforeEach(() => {
  jest.clearAllMocks()
  try { localStorage.clear() } catch { /* ignore */ }
  mGet.mockImplementation(async (url: string) => {
    if (url === '/assets/images') {
      return { success: true, data: { images: [{ _id: 'i1', title: 'Logo', file: { url: '/uploads/user-images/abc.png?exp=1&sig=2' } }] } }
    }
    if (url === '/music/user-uploads') return { success: true, data: { tracks: [] } }
    return { success: true, data: [] }
  })
  mPost.mockResolvedValue({ success: true, data: {} })
})

it('uploads an image to /assets/images as the "image" field', async () => {
  const showToast = jest.fn()
  const { container } = render(<AssetLibraryView {...props(showToast)} />)
  const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(mPost).toHaveBeenCalled())
  const [endpoint, body] = mPost.mock.calls[0]
  expect(endpoint).toBe('/assets/images')
  expect((body as FormData).get('image')).toBeTruthy()
  expect((body as FormData).get('video')).toBeNull()
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Asset uploaded', 'success'))
})

it('lists uploaded images from the server with a same-origin URL', async () => {
  render(<AssetLibraryView {...props()} />)
  const img = await screen.findByAltText('Logo')
  expect(img.getAttribute('src')).toBe('/uploads/user-images/abc.png?exp=1&sig=2')
})

it('uploads a dropped file instead of only toasting', async () => {
  render(<AssetLibraryView {...props()} />)
  const zone = screen.getByRole('button', { name: 'Upload SFX' })
  const file = new File([new Uint8Array([1, 2, 3])], 'boom.wav', { type: 'audio/wav' })
  fireEvent.drop(zone, { dataTransfer: { files: [file] } })
  await waitFor(() => expect(mPost).toHaveBeenCalledWith('/music/user-uploads', expect.any(FormData), expect.anything()))
})
