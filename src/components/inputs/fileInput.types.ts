import type { AssetValue } from '../../assets/contracts'
import type { MaybePromise } from '../../contracts/load'
import type { UploadOperation } from '../../contracts/upload'

export type FileInputMode = 'asset' | 'file'

type CollectionValue<TValue, TMulti extends boolean | undefined> = TMulti extends true
  ? TValue[] | null
  : TMulti extends false
    ? TValue | null
    : TValue | TValue[] | null

export type FileInputModelValue<
  TMode extends FileInputMode = 'asset',
  TMulti extends boolean | undefined = false,
> = TMode extends 'file'
  ? CollectionValue<File, TMulti>
  : CollectionValue<AssetValue, TMulti>

export interface FileTransformContext {
  signal: AbortSignal
}

export type FileTransform = (file: File, context: FileTransformContext) => MaybePromise<File>

export type FileInputProps<TMode extends FileInputMode = 'asset', TMulti extends boolean = false> = {
  mode?: TMode
  accept?: readonly string[]
  maxSize?: number
  multi?: TMulti
  limit?: number
  transform?: FileTransform
  destination?: TMode extends 'file' ? never : string
  upload?: TMode extends 'file' ? never : UploadOperation<AssetValue>
  disabled?: boolean
  error?: string
  field?: string
  label?: string
  helperMessage?: string
  required?: boolean
}

export type ImageInputProps<TMode extends FileInputMode = 'asset', TMulti extends boolean = false> = FileInputProps<TMode, TMulti> & {
  disableInformation?: boolean
  additionalInfo?: string
}

export type CameraInputProps<TMode extends FileInputMode = 'asset'> = Pick<
  FileInputProps<TMode, false>,
  'mode' | 'maxSize' | 'transform' | 'destination' | 'upload' | 'disabled' | 'error' | 'field' | 'label' | 'helperMessage' | 'required'
>

export type DrawingCanvasProps<TMode extends FileInputMode = 'asset'> = CameraInputProps<TMode> & {
  width?: number
  height?: number
}

export type FileInputPublicProps<TMode extends FileInputMode = 'asset', TMulti extends boolean = false> = FileInputProps<TMode, TMulti> & {
  modelValue?: FileInputModelValue<TMode, TMulti>
}
