import { type SongMetadata } from '../../server/types';

export default function Metadata(props: any) {
  const { metadata }: { metadata: SongMetadata } = props;

  return metadata ? (
    <div>
      <img
        src={metadata.cover}
        alt={metadata.title}
        className={'max-w-sm mt-10 mx-5 drop-shadow-xl'}
      />

      <h2 className={'pt-10 text-center font-bold tracking-wide'}>
        {metadata.title}
      </h2>

      <h2 className={'pt-2 text-center font-semibold tracking-wide'}>
        {metadata.artist}
      </h2>

      <p className={'pt-2 text-center'}>{metadata.album}</p>
    </div>
  ) : (
    <div>
      <h2 className={'pt-10 text-center font-bold tracking-wide'}>
        All quiet in the studio...
      </h2>
    </div>
  );
}
