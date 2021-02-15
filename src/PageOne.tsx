import React from 'react';
import {
  Tag,
  message,
  Table,
  Tooltip,
  Spin,
  Modal,
  Slider,
  Input,
  InputNumber,
  Select,
  Radio,
  RadioChangeEvent,
  Button,
} from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import {
  deDepartmentList,
  frDepartmentList,
  mxDepartmentList,
  ukDepartmentList,
  usDepartmentList,
} from '../config/allDp';
// import axios from 'axios';
import { createAxios, PromiseLimit, createTimeTag } from './util';
import cheerio from 'cheerio';
import * as xlsx from 'node-xlsx';
import { remote, shell } from 'electron';
import * as path from 'path';
import fs from 'fs';
const { dialog } = remote;
const { Search } = Input;
const { Option } = Select;
const COUNTRY_LIST = [
  {
    id: 0,
    name: '美国',
    url: 'https://www.amazon.com',
    departmentList: usDepartmentList,
  },
  {
    id: 1,
    name: '英国',
    url: 'https://www.amazon.co.uk',
    departmentList: ukDepartmentList,
  },
  {
    id: 2,
    name: '德国',
    url: 'https://www.amazon.de',
    departmentList: deDepartmentList,
  },
  {
    id: 3,
    name: '法国',
    url: 'https://www.amazon.fr',
    departmentList: frDepartmentList,
  },
  {
    id: 4,
    name: '墨西哥',
    url: 'https://www.amazon.com.mx',
    departmentList: mxDepartmentList,
  },
];
const tableColumns = [
  {
    title: 'asin',
    dataIndex: 'asin',
    key: 'asin',
  },
  {
    title: 'department',
    dataIndex: 'department',
    key: 'department',
  },
];
export default function PageOne() {
  const [countryIndex, setcountryIndex] = React.useState(0);
  const onSelectedCountry = (e: RadioChangeEvent) => {
    if (!getAsinDataLoading) {
      setcountryIndex(e.target.value);
      setPageCount(0);
      setNeedPageCount(1);
    } else message.warning('当前正在获取asin数据');
  };
  const departmentList = React.useMemo(() => {
    return COUNTRY_LIST[countryIndex].departmentList;
  }, [countryIndex]);
  const [curDepartment, setCurDepartment] = React.useState(
    () => departmentList[0]
  );
  const [pageCount, setPageCount] = React.useState(0);
  const [needPageCount, setNeedPageCount] = React.useState(1);
  const transSetNeedPageCount = (val: any) => setNeedPageCount(Number(val));
  const [contentLoading, setContentLoading] = React.useState(false);
  const [tableLoading, setTableLoading] = React.useState(false);
  const onSelectDepartment = (e: RadioChangeEvent) => {
    const fn = () => {
      const selectedName = e.target.value;
      const curCountry = COUNTRY_LIST[countryIndex];
      const findItem = curCountry.departmentList.find(
        (i) => i.name === selectedName
      );
      if (findItem) {
        setCurDepartment(findItem);
        setContentLoading(true);
        setAsinsObj({});
        createAxios()
          .get(findItem.searchUrl)
          .then(({ data: pageData }) => {
            const $3 = cheerio.load(pageData);
            setPageCount(Number($3('.a-pagination .a-last').prev().text()));
          })
          .catch((err) => message.warning(err.message))
          .finally(() => {
            setContentLoading(false);
          });
      }
      setStatusText(`当前选中：${curCountry.name}-${selectedName}`);
    };
    if (!getAsinDataLoading) {
      fn();
    } else message.warning('当前正在获取asin数据');
  };
  const [asinsObj, setAsinsObj] = React.useState<
    | {
        [key: string]: {
          asin: string;
          department: string;
        };
      }
    | {}
  >({});
  const checkEveryAsin = (fromAsinObj: {
    [key: string]: {
      asin: string;
      department: string;
    };
  }) => {
    // console.log('checkEveryAsin', fromAsinObj);
    let _tempObj = { ...fromAsinObj };
    const limit2 = new PromiseLimit(20, () => {
      console.log('check all success');
      setStatusText('全部asin检查完毕');
      setGetAsinDataLoading(false);
      setAsinsObj(_tempObj);
    });
    setTotalCount(Object.keys(_tempObj).length);
    let _sCount = 0;
    let _fCount = 0;
    Object.keys(_tempObj).forEach((asinKey) => {
      limit2.run(() => {
        let fn = () => {
          return new Promise<void>((resolve) => {
            let asinUrl = COUNTRY_LIST[countryIndex].url + '/dp/' + asinKey;
            createAxios()
              .get(asinUrl)
              .then(({ data: asinData }) => {
                const $ = cheerio.load(asinData);
                _tempObj[asinKey].department = $(
                  '#wayfinding-breadcrumbs_feature_div > ul'
                )
                  .text()
                  .replace(/\s/g, '');
                setSuccessCount(++_sCount);
                resolve();
              })
              .catch((err) => {
                console.log(err.message);
                setFailCount(++_fCount);
                limit2.run(fn); // run again
                resolve();
              });
          });
        };
        return fn();
      });
    });
  };
  const [getAsinDataLoading, setGetAsinDataLoading] = React.useState(false);
  const onGetAsinData = () => {
    if (pageCount > 0) {
      setGetAsinDataLoading(true);
      setIsExpand(true);
      message.info('任务开始');
      const searchAsinList: string[] = [];
      setStatusText('正在获取搜索页的asin');
      const limit1 = new PromiseLimit(10, () => {
        console.log('搜素页limit获取完成', searchAsinList);
        const _resAsinObj = searchAsinList.reduce<any>((acc, cur) => {
          acc[cur] = { asin: cur, department: '' };
          return acc;
        }, {});
        setAsinsObj(_resAsinObj);
        setStatusText('搜素页asin收集完成，准备检查每个asin');
        checkEveryAsin(_resAsinObj);
      });
      const searchUrlList = Array(needPageCount)
        .fill(null)
        .map((i, index) => {
          return `${curDepartment.searchUrl}&page=${index + 1}`;
        });
      searchUrlList.forEach((url) => {
        limit1.run(() => {
          return new Promise<void>((resolve, reject) => {
            // const { data: searchData } = await createAxios().get(url);
            createAxios()
              .get(url)
              .then(({ data: searchData }) => {
                const $ = cheerio.load(searchData);
                const curPageAsins = [
                  ...$('.s-result-list [data-asin]').map((i, el) =>
                    $(el).attr('data-asin')
                  ),
                ].filter((i) => !!i);
                searchAsinList.push(...curPageAsins);
                resolve();
              })
              .catch(() => {
                reject();
              });
          });
        });
      });
      console.log(searchUrlList);
    } else message.warning('请先选择分类');
  };
  const onExportExcel = () => {
    const excelData: any = xlsx.build([
      {
        name: 'sheet',
        data: [
          ['asin', 'department'],
          ...(Object.values(asinsObj).length
            ? Object.values(asinsObj).map(Object.values)
            : []),
        ],
      },
    ]);
    const fileName = `${COUNTRY_LIST[countryIndex].name}-${
      curDepartment.name
    }-${createTimeTag()}.xlsx`;
    dialog
      .showSaveDialog({
        title: '选择导出表格保存位置',
        defaultPath: path.join(__dirname, `../output/${fileName}`),
        buttonLabel: 'Save',
        filters: [
          {
            name: 'xlsx',
            extensions: ['xlsx'],
          },
        ],
      })
      .then((file) => {
        if (!file.canceled) {
          if (file.filePath)
            fs.writeFile(file.filePath.toString(), excelData, (err) => {
              if (!err) message.success('保存文件成功');
            });
        }
      });
  };
  const onOpenOutputDir = () => {
    shell.openPath(path.join(__dirname, '../output/'));
  };
  const onClearTableData = () => setAsinsObj({});
  // footer
  const [isExpand, setIsExpand] = React.useState(false);
  const [statusText, setStatusText] = React.useState('初始化');
  const onFooterClick = () => {
    setIsExpand(!isExpand);
  };
  const [totalCount, setTotalCount] = React.useState(0);
  const [successCount, setSuccessCount] = React.useState(0);
  const [failCount, setFailCount] = React.useState(0);
  return (
    <>
      <header className="country">
        <div style={{}}>
          <span>国家：</span>
          <Radio.Group onChange={onSelectedCountry} value={countryIndex}>
            {COUNTRY_LIST.map((i) => (
              <Radio value={i.id} key={i.id}>
                {i.name}
              </Radio>
            ))}
          </Radio.Group>
        </div>
      </header>
      <section className="content">
        <div className="content-left" style={{ width: 'fit-content' }}>
          <Radio.Group
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'hidden',
            }}
            onChange={onSelectDepartment}
          >
            {departmentList.map((i) => (
              <Radio style={{ padding: '6px 0' }} value={i.name} key={i.name}>
                {i.name}
                {i.stars4 && (
                  <Tag color="cyan" style={{ marginLeft: 6 }}>
                    有4星
                  </Tag>
                )}
              </Radio>
            ))}
          </Radio.Group>
        </div>
        <div className="content-right">
          <Spin spinning={contentLoading}>
            <div className="tool-box">
              <div className="tool-item">
                <div className="item-label">分类url:</div>
                <div>
                  <Tooltip title={pageCount > 0 ? curDepartment.searchUrl : ''}>
                    <Input
                      readOnly
                      value={pageCount > 0 ? curDepartment.searchUrl : ''}
                    />
                  </Tooltip>
                </div>
              </div>
              <div className="tool-item">
                <div className="item-label">结果页数:</div>
                <div>
                  <InputNumber readOnly value={Number(pageCount)} />
                </div>
              </div>
              <div className="tool-item">
                <div className="item-label">需要页数:</div>
                <div style={{}}>
                  <InputNumber
                    onChange={transSetNeedPageCount}
                    max={Number(pageCount)}
                    min={1}
                    value={needPageCount}
                  />
                </div>
              </div>
            </div>
            <div className="button-box">
              <Button
                size="middle"
                type="primary"
                onClick={onGetAsinData}
                loading={getAsinDataLoading}
              >
                获取ASIN
              </Button>
              <Button
                disabled={Object.values(asinsObj).length === 0}
                style={{ marginLeft: 20 }}
                onClick={onExportExcel}
                size="middle"
                type="primary"
              >
                导出表格
              </Button>
              <Button
                danger
                disabled={Object.values(asinsObj).length === 0}
                onClick={onClearTableData}
                style={{ marginLeft: 20 }}
              >
                清空表格
              </Button>
              <Button onClick={onOpenOutputDir} style={{ marginLeft: 20 }}>
                打开输出目录
              </Button>
            </div>
          </Spin>
          <Spin spinning={tableLoading}>
            <Table
              rowKey="asin"
              bordered
              size="small"
              pagination={{
                defaultPageSize: 14,
                pageSize: 14,
              }}
              style={{ marginTop: 10 }}
              dataSource={Object.values(asinsObj) as any}
              columns={tableColumns}
            />
          </Spin>
        </div>
      </section>
      {/* <span>状态栏：</span> */}
      <footer
        className="footer"
        onClick={onFooterClick}
        style={{ height: isExpand ? 108 : 36 }}
      >
        <div className="footer-icon">
          {isExpand ? <DownOutlined /> : <UpOutlined />}
        </div>
        <div className="footerItemHeight">
          <span>{statusText}</span>
        </div>
        <div style={{ height: 108 - 36 }}>
          <div>
            <span>总任务数：</span>
            <span>{totalCount}</span>
          </div>
          <div>
            <span>成功请求数：</span>
            <span>{successCount}</span>
          </div>
          <div>
            <span>失败请求数：</span>
            <span>{failCount}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
