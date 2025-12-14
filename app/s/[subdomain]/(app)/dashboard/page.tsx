"use client";

export default function Overview() {
  return (
    <div className="flex flex-col">
      <div className="grid lg:grid-cols-12 grid-cols-1 gap-y-6 lg:gap-x-6">
        <div className="col-span-7">
          <div className="h-full p-5 relative">
            <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
              <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] left-[10vw] rotate-[37deg] opacity-80"></div>
              <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -left-[15vw] rotate-[50deg]"></div>
              <div className="w-[17vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[70px] absolute top-[20vw] -left-[10vw] -rotate-[37deg] opacity-80"></div>
            </div>
            <div className="relative">
              <div className="flex flex-wrap gap-y-10 items-end">
                <div className="lg:-mt-9 -mt-10 md:w-1/2 md:order-last text-center">
                  <img
                    src="images/bot-2.png"
                    alt=""
                    className="max-w-full inline-block"
                  />
                </div>
                <div className="pb-5 flex flex-col items-start justify-center [&_h1_strong]:text-primary-500 space-y-5 md:w-1/2 o md:order-first [&_strong]:text-primary-500">
                  <h2 className="xl:text-4xl lg:text-3xl md:text-2xl text-xl font-extrabold leading-[1.2]">
                    Create <strong>AI Chatbot</strong> in No Time{" "}
                  </h2>
                  <a
                    href="#"
                    className="btn btn-secondary !inline-flex gap-1 !justify-start"
                  >
                    Create AI Agent
                    <img src="images/icons/arrow-right.svg" alt="" />
                  </a>
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 flex flex-wrap justify-between items-center gap-6">
                <div className="flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Total Documents
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      1,247
                    </span>
                    <span className="text-sm text-green-600 font-bold flex [&_img]:icon-theme-green-500">
                      <img
                        src="images/icons/arrow-upward.svg"
                        alt="Up"
                        width="16"
                      />{" "}
                      12%
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Total Queries
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      8,392
                    </span>
                    <span className="text-sm text-green-600 font-bold flex [&_img]:icon-theme-green-500">
                      <img
                        src="images/icons/arrow-upward.svg"
                        alt="Up"
                        width="16"
                      />{" "}
                      23%
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Active Users
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      156
                    </span>
                    <span className="text-sm text-red-600 font-bold flex [&_img]:icon-red-500">
                      <img
                        src="images/icons/arrow-downward.svg"
                        alt="Down"
                        width="16"
                      />{" "}
                      8%
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Success Rate
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      94.2%
                    </span>
                    <span className="text-sm text-green-600 font-bold flex [&_img]:icon-theme-green-500">
                      <img
                        src="images/icons/arrow-upward.svg"
                        alt="Up"
                        width="16"
                      />{" "}
                      2%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-5">
          <div className="rounded-xl border light-border bg-white h-full p-4">
            <div className="flex flex-col items-center gap-3">
              <div className="panel-header w-full flex justify-between items-center gap-3">
                <h3 className="mb-0 text-lg font-semibold text-gray-950">
                  Analytics
                </h3>
                <select
                  name=""
                  id=""
                  className="form-select form-select-sm !max-w-48 bg-white"
                >
                  <option value="">Select</option>
                  <option value="">Membership</option>
                </select>
              </div>
              <div className="panel-body">
                <img
                  src="images/graph-1.jpg"
                  alt=""
                  className="img-fluid"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-6">
          <div className="rounded-xl border light-border bg-white h-full p-4">
            <div className="flex flex-col items-center gap-3">
              <div className="panel-header w-full flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="mb-0 text-lg font-semibold text-gray-950">
                    Recent Documents
                  </h3>
                  <span className="text-sm text-secondary-400">
                    Latest document uploads and processing status
                  </span>
                </div>
                <button className="btn btn-secondary !inline-flex gap-1">
                  View All{" "}
                  <img src="images/icons/arrow-right.svg" alt="" />
                </button>
              </div>
              <div className="panel-body w-full">
                <div className="overflow-x-auto">
                  <table className="table table-row-hover w-full">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Uploaded</th>
                        <th>Size</th>
                        <th>Queries</th>
                        <th>Status</th>
                        <th className="text-right"></th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td>
                          <div className="flex items-center gap-1">
                            <img
                              src="images/icons/doc.svg"
                              alt="Document"
                            />
                            <span className="text-sm font-semibold text-wrap break-all">
                              Employee Handbook.pdf
                            </span>
                          </div>
                        </td>
                        <td className="text-nowrap">2 hours ago</td>
                        <td className="text-nowrap">2.4 MB</td>
                        <td className="text-nowrap">24 queries</td>
                        <td>
                          <span className="px-3 py-1 inline-block text-xs font-semibold text-white rounded-full bg-primary-500">
                            Processed
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-transparent !size-8 !p-0 !flex justify-center items-center">
                            <img
                              src="images/icons/three-dots-vertical.svg"
                              alt=""
                            />
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div className="flex items-center gap-1">
                            <img
                              src="images/icons/doc.svg"
                              alt="Document"
                            />
                            <span className="text-sm font-semibold">
                              Handbook.pdf
                            </span>
                          </div>
                        </td>
                        <td>2 hours ago</td>
                        <td>2.4 MB</td>
                        <td>24 queries</td>
                        <td>
                          <span className="px-3 py-1 inline-block text-xs font-semibold text-white rounded-full bg-primary-500">
                            Processed
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-transparent !size-8 !p-0 !flex justify-center items-center">
                            <img
                              src="images/icons/three-dots-vertical.svg"
                              alt=""
                            />
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div className="flex items-center gap-1">
                            <img
                              src="images/icons/doc.svg"
                              alt="Document"
                            />
                            <span className="text-sm font-semibold">
                              Financial Report Q3.xlsx
                            </span>
                          </div>
                        </td>
                        <td>2 hours ago</td>
                        <td>2.4 MB</td>
                        <td>24 queries</td>
                        <td>
                          <span className="px-3 py-1 inline-block text-xs font-semibold text-white rounded-full bg-primary-500">
                            Processed
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-transparent !size-8 !p-0 !flex justify-center items-center">
                            <img
                              src="images/icons/three-dots-vertical.svg"
                              alt=""
                            />
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div className="flex items-center gap-1">
                            <img
                              src="images/icons/doc.svg"
                              alt="Document"
                            />
                            <span className="text-sm font-semibold">
                              Market Guidelines.pptx
                            </span>
                          </div>
                        </td>
                        <td>2 hours ago</td>
                        <td>2.4 MB</td>
                        <td>24 queries</td>
                        <td>
                          <span className="px-3 py-1 inline-block text-xs font-semibold text-white rounded-full bg-red-500">
                            Error
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-transparent !size-8 !p-0 !flex justify-center items-center">
                            <img
                              src="images/icons/three-dots-vertical.svg"
                              alt=""
                            />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-6">
          <div className="rounded-xl border light-border bg-white h-full p-4">
            <div className="flex flex-col items-center gap-3">
              <div className="panel-header w-full flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="mb-0 text-lg font-semibold text-gray-950">
                    Recent Conversations
                  </h3>
                  <span className="text-sm text-secondary-400">
                    Latest AI chat interactions and confidence scores
                  </span>
                </div>
                <button className="btn btn-secondary !inline-flex gap-1">
                  View All{" "}
                  <img src="images/icons/arrow-right.svg" alt="" />
                </button>
              </div>
              <div className="panel-body w-full">
                <div className="overflow-x-auto">
                  <div className="divide-y divide-gray-200">
                    <div className="flex flex-wrap justify-between gap-3 py-3">
                      <div className="mr-auto">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-wrap break-all">
                            What are the vacation policies for remote
                            employees?
                          </span>
                          <ul className="flex gap-x-4">
                            <li className="text-xs font-medium text-gray-500">
                              2 hours ago
                            </li>
                            <li className="text-xs font-medium text-gray-500">
                              2 sources
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div>
                        <span className="px-3 py-1 inline-block text-xs font-semibold text-nowrap text-white rounded-full bg-primary-500">
                          95% confidence
                        </span>
                      </div>
                      <div>
                        <div className="flex flex-col flex-start">
                          <button className="btn btn-transparent !size-8 !p-0 !flex justify-center items-center">
                            <img src="images/icons/eye.svg" alt="" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between gap-3 py-3">
                      <div className="mr-auto">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-wrap break-all">
                            How do I submit an expense report?
                          </span>
                          <ul className="flex gap-x-4">
                            <li className="text-xs font-medium text-gray-500">
                              2 hours ago
                            </li>
                            <li className="text-xs font-medium text-gray-500">
                              2 sources
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div>
                        <span className="px-3 py-1 inline-block text-xs font-semibold text-nowrap text-white rounded-full bg-primary-500">
                          85% confidence
                        </span>
                      </div>
                      <div>
                        <div className="flex flex-col flex-start">
                          <button className="btn btn-transparent !size-8 !p-0 !flex justify-center items-center">
                            <img src="images/icons/eye.svg" alt="" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between gap-3 py-3">
                      <div className="mr-auto">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-wrap break-all">
                            What are the requirements for the new product
                            feature?
                          </span>
                          <ul className="flex gap-x-4">
                            <li className="text-xs font-medium text-gray-500">
                              2 hours ago
                            </li>
                            <li className="text-xs font-medium text-gray-500">
                              2 sources
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div>
                        <span className="px-3 py-1 inline-block text-xs font-semibold text-nowrap text-white rounded-full bg-primary-500">
                          95% confidence
                        </span>
                      </div>
                      <div>
                        <div className="flex flex-col flex-start">
                          <button className="btn btn-transparent !size-8 !p-0 !flex justify-center items-center">
                            <img src="images/icons/eye.svg" alt="" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
