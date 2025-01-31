import { act, fireEvent, render } from '@testing-library/react';
import { _rs as onEsResize } from 'rc-resize-observer/es/utils/observerUtil';
import { _rs as onLibResize } from 'rc-resize-observer/lib/utils/observerUtil';
import { spyElementPrototypes } from 'rc-util/lib/test/domHook';
import { resetWarned } from 'rc-util/lib/warning';
import React from 'react';
import { VirtualTable, type VirtualTableProps } from '../src';

vi.mock('rc-virtual-list', async () => {
  const RealVirtualList = ((await vi.importActual('rc-virtual-list')) as any).default;

  const WrapperVirtualList = React.forwardRef((props: any, ref) => (
    <RealVirtualList ref={ref} {...props} data-scroll-width={props.scrollWidth} />
  ));

  return {
    default: WrapperVirtualList,
  };
});

describe('Table.Virtual', () => {
  let scrollLeftCalled = false;

  beforeAll(() => {
    spyElementPrototypes(HTMLElement, {
      getBoundingClientRect: () => ({
        width: 50,
      }),
      scrollLeft: {
        get: () => {
          scrollLeftCalled = true;
          return 100;
        },
        set: () => {},
      },
    });
  });

  beforeEach(() => {
    scrollLeftCalled = false;
    vi.useFakeTimers();
    resetWarned();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function waitFakeTimer() {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-loop-func
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });
    }
  }

  function resize(target: HTMLElement) {
    act(() => {
      onLibResize([{ target } as any]);
      onEsResize([{ target } as any]);
    });
  }

  function getTable(props?: Partial<VirtualTableProps<any>>) {
    return render(
      <VirtualTable
        columns={[
          {
            dataIndex: 'name',
          },
          {
            dataIndex: 'age',
          },
          {
            dataIndex: 'address',
          },
        ]}
        rowKey="name"
        scroll={{ x: 100, y: 100 }}
        listItemHeight={20}
        data={new Array(100).fill(null).map((_, index) => ({
          name: `name${index}`,
          age: index,
          address: `address${index}`,
        }))}
        {...props}
      />,
    );
  }

  it('should work', async () => {
    const { container } = getTable();

    await waitFakeTimer();

    expect(container.querySelector('.rc-virtual-list')).toBeTruthy();
  });

  it('warning for scroll props is not a number', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    getTable({
      scroll: {} as any,
    });

    expect(errSpy).toHaveBeenCalledWith('Warning: `scroll.y` in virtual table must be number.');
  });

  it('rowSpan', () => {
    const { container } = getTable({
      columns: [
        {
          dataIndex: 'name',
          onCell: (_, index) => ({
            rowSpan: index % 2 ? 0 : 2,
          }),
        },
      ],
    });

    expect(container.querySelector('.rc-table-row-extra').textContent).toBe('name0');
  });

  it('empty', () => {
    const { container } = getTable({
      data: [],
    });

    expect(container.querySelector('.rc-table-placeholder').textContent).toBe('No Data');
  });

  describe('expandable', () => {
    it('basic', () => {
      const { container } = getTable({
        expandable: {
          expandedRowKeys: ['name0', 'name3'],
          expandedRowRender: record => record.name,
        },
      });

      const expandedCells = container.querySelectorAll('.rc-table-expanded-row-cell');
      expect(expandedCells).toHaveLength(2);
      expect(expandedCells[0].textContent).toBe('name0');
      expect(expandedCells[1].textContent).toBe('name3');
    });

    it('fixed', () => {
      const { container } = getTable({
        columns: [
          {
            dataIndex: 'name',
            fixed: 'left',
          },
          {
            dataIndex: 'age',
          },
          {
            dataIndex: 'address',
          },
        ],
        expandable: {
          expandedRowKeys: ['name0', 'name3'],
          expandedRowRender: record => record.name,
        },
      });

      const expandedCells = container.querySelectorAll('.rc-table-expanded-row-cell-fixed');
      expect(expandedCells).toHaveLength(2);
      expect(expandedCells[0].textContent).toBe('name0');
      expect(expandedCells[1].textContent).toBe('name3');
    });
  });

  it('scroll sync', () => {
    const { container } = getTable();

    resize(container.querySelector('.rc-table')!);

    scrollLeftCalled = false;
    expect(scrollLeftCalled).toBeFalsy();

    fireEvent.wheel(container.querySelector('.rc-virtual-list-holder')!, {
      deltaX: 10,
    });
    expect(scrollLeftCalled).toBeTruthy();
  });

  it('should follow correct width', () => {
    const { container } = getTable({
      columns: [
        {
          width: 93,
        },
        {
          width: 510,
        },
      ],
      scroll: {
        x: 1128,
        y: 10,
      },
      data: [{}],
    });

    expect(container.querySelector('.rc-virtual-list')).toHaveAttribute('data-scroll-width', '603');
  });

  it('render params should correct', () => {
    const { container } = getTable({
      columns: [
        {
          width: 93,
          render: (_, __, index) => <div className="bamboo">{index}</div>,
        },
      ],
      scroll: {
        x: 1128,
        y: 10,
      },
      data: [{}],
    });

    expect(container.querySelector('.bamboo').textContent).toEqual('0');
  });

  it('columns less than width', async () => {
    const { container } = getTable({
      columns: [{}, {}],
      scroll: {
        y: 10,
      },
      getContainerWidth: () => 200,
      data: [{}],
    });

    resize(container.querySelector('.rc-table'));

    await waitFakeTimer();

    expect(container.querySelectorAll('col')).toHaveLength(2);
    expect(container.querySelectorAll('col')[0]).toHaveStyle({ width: '100px' });
    expect(container.querySelectorAll('col')[1]).toHaveStyle({ width: '100px' });
  });
});
